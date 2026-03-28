import { supabase } from "../config/supabaseConfig";
import { enforceCooldown } from "../utils/rateLimit";
import { createNotificationsForUsers } from "./notificationService";
import { updateGroupActivity } from "./groupService";

const ADD_EXPENSE_COOLDOWN_MS = 2 * 1000;
const EXPENSES_TABLE = "expenses";

const getExpenseServiceErrorMessage = (
  error,
  fallback = "Expense service request failed.",
) => {
  if (error?.code === "PGRST205") {
    return "The Supabase 'expenses' table is missing. Create public.expenses and refresh the schema cache.";
  }

  return error?.message || fallback;
};

const formatCurrency = (amount) => `Rs ${Number(amount || 0).toFixed(2)}`;

const buildExpenseNotificationMessage = (
  actorName,
  amount,
  reason,
  action = "added",
) =>
  `${actorName || "Someone"} ${action} ${formatCurrency(amount)} for ${reason || "an expense"}.`;

/*
|--------------------------------------------------------------------------
| sanitizeExpensePayload
|--------------------------------------------------------------------------
| Validates and cleans expense data before saving to Firestore.
*/
const sanitizeExpensePayload = (groupId, expenseData = {}) => {
  const amount = Number(expenseData.amount);
  const description = String(expenseData.description || "")
    .replace(/\s+/g, " ")
    .trim();
  const splitBetween = Array.isArray(expenseData.splitBetween)
    ? [...new Set(expenseData.splitBetween.filter(Boolean))]
    : [];

  if (!groupId) {
    throw new Error("Group ID is required.");
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Expense amount must be greater than zero.");
  }

  if (description.length < 2 || description.length > 80) {
    throw new Error("Description must be between 2 and 80 characters.");
  }

  if (!expenseData.paidBy) {
    throw new Error("A payer is required.");
  }

  if (splitBetween.length === 0 || splitBetween.length > 25) {
    throw new Error("Expense must be split with between 1 and 25 members.");
  }

  return {
    ...expenseData,
    amount: Number(amount.toFixed(2)),
    description,
    splitBetween,
  };
};

/*
|--------------------------------------------------------------------------
| addExpense(groupId, expenseData)
|--------------------------------------------------------------------------
| Creates a new expense document in Supabase.
|
| expenseData structure:
| {
|   description: string
|   amount: number
|   category: string
|   paidBy: userId
|   splitBetween: [userIds]
|   createdBy: userId
| }
|
| Supabase table: expenses
*/
export const addExpense = async (groupId, expenseData) => {
  try {
    const sanitizedExpense = sanitizeExpensePayload(groupId, expenseData);
    const actorId = sanitizedExpense.createdBy || sanitizedExpense.paidBy;

    const cooldown = enforceCooldown(
      `add-expense:${actorId}:${groupId}`,
      ADD_EXPENSE_COOLDOWN_MS,
    );

    if (!cooldown.allowed) {
      throw new Error("Please wait a moment before adding another expense.");
    }

    const expense = {
      groupId,
      ...sanitizedExpense,
      createdAt: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from(EXPENSES_TABLE)
      .insert(expense)
      .select()
      .single();

    if (error) throw error;

    await createNotificationsForUsers(
      sanitizedExpense.splitBetween,
      {
        type: "expense_added",
        title: expense.groupName || "New expense added",
        message: buildExpenseNotificationMessage(
          expense.createdByName,
          expense.amount,
          expense.description,
          "added",
        ),
        groupId,
        expenseId: data.id,
        metadata: {
          amount: expense.amount,
          category: expense.category,
          description: expense.description,
          groupName: expense.groupName || "",
          actorName: expense.createdByName || "Someone",
          reason: expense.description,
        },
      },
      actorId,
    );

    // Update group's last activity timestamp
    await updateGroupActivity(groupId);

    return { success: true, expenseId: data.id };
  } catch (error) {
    console.error("Add expense error:", error);
    return {
      success: false,
      error: getExpenseServiceErrorMessage(error, "Failed to add expense"),
    };
  }
};

/*
|--------------------------------------------------------------------------
| getGroupExpenses(groupId, onUpdate)
|--------------------------------------------------------------------------
| Real-time listener for expenses belonging to a group.
|
| Supabase real-time subscription on expenses table.
|
| Calls onUpdate(expenses) whenever data changes.
| Returns unsubscribe() to stop listening.
*/
export const getGroupExpenses = (groupId, onUpdate) => {
  try {
    const channel = supabase
      .channel(`group-expenses-${groupId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "expenses",
          filter: `groupId=eq.${groupId}`,
        },
        () => {
          // Re-fetch all expenses for the group when there's a change
          supabase
            .from(EXPENSES_TABLE)
            .select("*")
            .eq("groupId", groupId)
            .order("createdAt", { ascending: false })
            .then(({ data, error }) => {
              if (error) {
                console.error(
                  "Error fetching group expenses:",
                  getExpenseServiceErrorMessage(error),
                  error,
                );
                return;
              }
              onUpdate(data || []);
            });
        },
      )
      .subscribe();

    // Initial fetch
    supabase
      .from(EXPENSES_TABLE)
      .select("*")
      .eq("groupId", groupId)
      .order("createdAt", { ascending: false })
      .then(({ data, error }) => {
        if (error) {
          console.error(
            "Error fetching group expenses:",
            getExpenseServiceErrorMessage(error),
            error,
          );
          return;
        }
        onUpdate(data || []);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  } catch (error) {
    console.error("Group expenses listener error:", error);
    return () => {};
  }
};

/*
|--------------------------------------------------------------------------
| getUserExpenses(userId, onUpdate)
|--------------------------------------------------------------------------
| Real-time listener for expenses where the user
| is included in the splitBetween array.
|
| Supabase real-time subscription.
|
| Used to show personal activity feed (Activity screen).
| Returns unsubscribe() to stop listening.
*/
export const getUserExpenses = (userId, onUpdate) => {
  try {
    const channel = supabase
      .channel(`user-expenses-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "expenses",
          filter: `splitBetween@>${JSON.stringify([userId])}`, // PostgreSQL array contains
        },
        () => {
          // Re-fetch all expenses for the user when there's a change
          supabase
            .from(EXPENSES_TABLE)
            .select("*")
            .contains("splitBetween", [userId])
            .order("createdAt", { ascending: false })
            .then(({ data, error }) => {
              if (error) {
                console.error(
                  "Error fetching user expenses:",
                  getExpenseServiceErrorMessage(error),
                  error,
                );
                return;
              }
              onUpdate(data || []);
            });
        },
      )
      .subscribe();

    // Initial fetch
    supabase
      .from(EXPENSES_TABLE)
      .select("*")
      .contains("splitBetween", [userId])
      .order("createdAt", { ascending: false })
      .then(({ data, error }) => {
        if (error) {
          console.error(
            "Error fetching user expenses:",
            getExpenseServiceErrorMessage(error),
            error,
          );
          return;
        }
        onUpdate(data || []);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  } catch (error) {
    console.error("User expenses listener error:", error);
    return () => {};
  }
};

/*
|--------------------------------------------------------------------------
| getUserExpensesOnce(userId)
|--------------------------------------------------------------------------
| One-time fetch of all expenses where user is in splitBetween.
|
| Used for:
| - Profile screen stats (total expenses, amount settled)
| - Any calculation that doesn't need real-time updates
|
| NOTE: This is a single fetch, NOT a real-time listener.
| Use getUserExpenses() if you need live updates.
*/
export const getUserExpensesOnce = async (userId) => {
  try {
    const { data, error } = await supabase
      .from(EXPENSES_TABLE)
      .select("*")
      .contains("splitBetween", [userId])
      .order("createdAt", { ascending: false });

    if (error) throw error;

    return { success: true, expenses: data || [] };
  } catch (error) {
    console.error("Fetch user expenses error:", error);
    return {
      success: false,
      error: getExpenseServiceErrorMessage(error, "Failed to fetch expenses"),
    };
  }
};

/*
|--------------------------------------------------------------------------
| getGroupExpensesOnce(groupId)
|--------------------------------------------------------------------------
| One-time fetch of all expenses for a group.
|
| Used for:
| - Balance calculations
| - Settlement computation
| - Analytics
|
| NOTE: No orderBy here intentionally — avoids needing
| a second composite index just for one-time reads.
*/
export const getGroupExpensesOnce = async (groupId) => {
  try {
    const { data, error } = await supabase
      .from(EXPENSES_TABLE)
      .select("*")
      .eq("groupId", groupId);

    if (error) throw error;

    return { success: true, expenses: data || [] };
  } catch (error) {
    console.error("Fetch group expenses error:", error);
    return {
      success: false,
      error: getExpenseServiceErrorMessage(
        error,
        "Failed to fetch group expenses",
      ),
    };
  }
};

/*
|--------------------------------------------------------------------------
| deleteExpense(expenseId)
|--------------------------------------------------------------------------
| Deletes an expense document from Supabase.
*/
export const deleteExpense = async (expenseId) => {
  try {
    const { error } = await supabase
      .from(EXPENSES_TABLE)
      .delete()
      .eq("id", expenseId);

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error("Delete expense error:", error);
    return {
      success: false,
      error: getExpenseServiceErrorMessage(error, "Failed to delete expense"),
    };
  }
};

export const updateExpense = async (
  expenseId,
  groupId,
  expenseData,
  actorId,
) => {
  try {
    if (!expenseId) {
      throw new Error("Expense ID is required.");
    }

    // Check if expense exists and user has permission
    const { data: existingExpense, error: fetchError } = await supabase
      .from(EXPENSES_TABLE)
      .select("*")
      .eq("id", expenseId)
      .single();

    if (fetchError) {
      if (fetchError.code === "PGRST116") {
        throw new Error("Expense not found.");
      }
      throw fetchError;
    }

    if (existingExpense.createdBy !== actorId) {
      throw new Error("Only the person who added this expense can edit it.");
    }

    const sanitizedExpense = sanitizeExpensePayload(groupId, expenseData);
    const affectedUserIds = [
      ...new Set([
        ...(existingExpense.splitBetween || []),
        ...(sanitizedExpense.splitBetween || []),
      ]),
    ];

    const { error } = await supabase
      .from(EXPENSES_TABLE)
      .update({
        ...sanitizedExpense,
        updatedAt: new Date().toISOString(),
      })
      .eq("id", expenseId);

    if (error) throw error;

    await createNotificationsForUsers(
      affectedUserIds,
      {
        type: "expense_updated",
        title:
          sanitizedExpense.groupName ||
          existingExpense.groupName ||
          "Expense updated",
        message: buildExpenseNotificationMessage(
          sanitizedExpense.createdByName ||
            existingExpense.createdByName ||
            "Someone",
          sanitizedExpense.amount,
          sanitizedExpense.description,
          "updated",
        ),
        groupId,
        expenseId,
        metadata: {
          amount: sanitizedExpense.amount,
          category: sanitizedExpense.category,
          description: sanitizedExpense.description,
          groupName:
            sanitizedExpense.groupName || existingExpense.groupName || "",
          actorName:
            sanitizedExpense.createdByName ||
            existingExpense.createdByName ||
            "Someone",
          reason: sanitizedExpense.description,
        },
      },
      actorId,
    );

    await updateGroupActivity(groupId);

    return { success: true };
  } catch (error) {
    console.error("Update expense error:", error);
    return {
      success: false,
      error: getExpenseServiceErrorMessage(error, "Failed to update expense"),
    };
  }
};

export const deleteExpenseByActor = async (expenseId, actorId) => {
  try {
    if (!expenseId) {
      throw new Error("Expense ID is required.");
    }

    // Check if expense exists and user has permission
    const { data: expense, error: fetchError } = await supabase
      .from(EXPENSES_TABLE)
      .select(
        "createdBy, createdByName, description, amount, category, groupId, groupName, splitBetween",
      )
      .eq("id", expenseId)
      .single();

    if (fetchError) {
      if (fetchError.code === "PGRST116") {
        throw new Error("Expense not found.");
      }
      throw fetchError;
    }

    if (expense.createdBy !== actorId) {
      throw new Error("Only the person who added this expense can delete it.");
    }

    const { error } = await supabase
      .from(EXPENSES_TABLE)
      .delete()
      .eq("id", expenseId);

    if (error) throw error;

    await createNotificationsForUsers(
      expense.splitBetween || [],
      {
        type: "expense_deleted",
        title: expense.groupName || "Expense removed",
        message: buildExpenseNotificationMessage(
          expense.createdByName,
          expense.amount,
          expense.description,
          "removed",
        ),
        groupId: expense.groupId,
        expenseId,
        metadata: {
          amount: expense.amount,
          category: expense.category,
          description: expense.description,
          groupName: expense.groupName || "",
          actorName: expense.createdByName || "Someone",
          reason: expense.description,
        },
      },
      actorId,
    );

    if (expense.groupId) {
      await updateGroupActivity(expense.groupId);
    }

    return { success: true };
  } catch (error) {
    console.error("Delete expense error:", error);
    return {
      success: false,
      error: getExpenseServiceErrorMessage(error, "Failed to delete expense"),
    };
  }
};
