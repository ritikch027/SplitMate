import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";

import { db } from "../config/firebaseConfig";
import { enforceCooldown } from "../utils/rateLimit";
import { updateGroupActivity } from "./groupService";

const ADD_EXPENSE_COOLDOWN_MS = 2 * 1000;

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
| Creates a new expense document in Firestore.
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
| Firestore path: expenses/{expenseId}
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

    // Generate a new document reference
    const expenseRef = doc(collection(db, "expenses"));
    const expenseId = expenseRef.id;

    const expense = {
      id: expenseId,
      groupId,
      ...sanitizedExpense,
      createdAt: serverTimestamp(),
    };

    // Save expense to Firestore
    await setDoc(expenseRef, expense);

    // Update group's last activity timestamp
    await updateGroupActivity(groupId);

    return { success: true, expenseId };
  } catch (error) {
    console.error("Add expense error:", error);
    return {
      success: false,
      error: error.message || "Failed to add expense",
    };
  }
};

/*
|--------------------------------------------------------------------------
| getGroupExpenses(groupId, onUpdate)
|--------------------------------------------------------------------------
| Real-time listener for expenses belonging to a group.
|
| Requires Firestore composite index:
|   Collection: expenses
|   Fields: groupId (Asc) + createdAt (Desc)
|
| Calls onUpdate(expenses) whenever data changes.
| Returns unsubscribe() to stop listening.
*/
export const getGroupExpenses = (groupId, onUpdate) => {
  try {
    const q = query(
      collection(db, "expenses"),
      where("groupId", "==", groupId),
      orderBy("createdAt", "desc"),
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const expenses = [];
      snapshot.forEach((doc) => expenses.push(doc.data()));
      onUpdate(expenses);
    });

    return unsubscribe;
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
| Requires Firestore composite index:
|   Collection: expenses
|   Fields: splitBetween (Arrays) + createdAt (Desc)
|
| Used to show personal activity feed (Activity screen).
| Returns unsubscribe() to stop listening.
*/
export const getUserExpenses = (userId, onUpdate) => {
  try {
    const q = query(
      collection(db, "expenses"),
      where("splitBetween", "array-contains", userId),
      orderBy("createdAt", "desc"),
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const expenses = [];
      snapshot.forEach((doc) => expenses.push(doc.data()));
      onUpdate(expenses);
    });

    return unsubscribe;
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
    const q = query(
      collection(db, "expenses"),
      where("splitBetween", "array-contains", userId),
      orderBy("createdAt", "desc"),
    );

    const snapshot = await getDocs(q);
    const expenses = [];
    snapshot.forEach((doc) => expenses.push(doc.data()));

    return { success: true, expenses };
  } catch (error) {
    console.error("Fetch user expenses error:", error);
    return {
      success: false,
      error: error.message || "Failed to fetch expenses",
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
    const q = query(
      collection(db, "expenses"),
      where("groupId", "==", groupId),
    );

    const snapshot = await getDocs(q);
    const expenses = [];
    snapshot.forEach((doc) => expenses.push(doc.data()));

    return { success: true, expenses };
  } catch (error) {
    console.error("Fetch group expenses error:", error);
    return {
      success: false,
      error: error.message || "Failed to fetch group expenses",
    };
  }
};

/*
|--------------------------------------------------------------------------
| deleteExpense(expenseId)
|--------------------------------------------------------------------------
| Deletes an expense document from Firestore.
*/
export const deleteExpense = async (expenseId) => {
  try {
    await deleteDoc(doc(db, "expenses", expenseId));
    return { success: true };
  } catch (error) {
    console.error("Delete expense error:", error);
    return {
      success: false,
      error: error.message || "Failed to delete expense",
    };
  }
};

export const updateExpense = async (expenseId, groupId, expenseData, actorId) => {
  try {
    if (!expenseId) {
      throw new Error("Expense ID is required.");
    }

    const expenseRef = doc(db, "expenses", expenseId);
    const snapshot = await getDoc(expenseRef);

    if (!snapshot.exists()) {
      throw new Error("Expense not found.");
    }

    const existingExpense = snapshot.data();

    if (existingExpense.createdBy !== actorId) {
      throw new Error("Only the person who added this expense can edit it.");
    }

    const sanitizedExpense = sanitizeExpensePayload(groupId, expenseData);

    await updateDoc(expenseRef, {
      ...sanitizedExpense,
      updatedAt: serverTimestamp(),
    });

    await updateGroupActivity(groupId);

    return { success: true };
  } catch (error) {
    console.error("Update expense error:", error);
    return {
      success: false,
      error: error.message || "Failed to update expense",
    };
  }
};

export const deleteExpenseByActor = async (expenseId, actorId) => {
  try {
    if (!expenseId) {
      throw new Error("Expense ID is required.");
    }

    const expenseRef = doc(db, "expenses", expenseId);
    const snapshot = await getDoc(expenseRef);

    if (!snapshot.exists()) {
      throw new Error("Expense not found.");
    }

    const expense = snapshot.data();

    if (expense.createdBy !== actorId) {
      throw new Error("Only the person who added this expense can delete it.");
    }

    await deleteDoc(expenseRef);

    if (expense.groupId) {
      await updateGroupActivity(expense.groupId);
    }

    return { success: true };
  } catch (error) {
    console.error("Delete expense error:", error);
    return {
      success: false,
      error: error.message || "Failed to delete expense",
    };
  }
};
