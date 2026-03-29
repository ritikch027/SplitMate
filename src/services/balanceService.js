import { supabase } from "../config/supabaseConfig";
import {
  calculatePerUserBalances,
  formatCurrency,
} from "../utils/balanceCalculator";
import { getGroupExpensesOnce } from "./expenseService";
import { getUserGroupsOnce, updateGroupActivity } from "./groupService";
import { sendPushNotificationsToUsers } from "./pushNotificationService";
import { getUsersByIds } from "./userService";

const SETTLEMENTS_TABLE = "settlements";
const NOTIFICATIONS_TABLE = "notifications";

/*
|------------------------------------------------------------------
| requireSession
|------------------------------------------------------------------
| Guards Edge Function invocations.
| Returns session if ready, throws if not available within 3s.
| Always call this before sendPushNotificationsToUsers.
*/
const requireSession = async () => {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session?.access_token) return session;

  return new Promise((resolve, reject) => {
    let resolved = false;

    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        subscription.unsubscribe();
        reject(new Error("Session not ready."));
      }
    }, 3000);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (newSession?.access_token && !resolved) {
        resolved = true;
        clearTimeout(timeout);
        subscription.unsubscribe();
        resolve(newSession);
      }
    });
  });
};

/*
|------------------------------------------------------------------
| safeSendPush
|------------------------------------------------------------------
| Wraps sendPushNotificationsToUsers with session guard.
| Never throws — logs warning and skips if session not ready.
*/
const safeSendPush = async (userIds, payload) => {
  try {
    await requireSession();
    await sendPushNotificationsToUsers(userIds, payload);
  } catch (pushError) {
    console.warn("Push notification skipped:", pushError.message);
  }
};

const buildGroupLookup = (groups = []) =>
  groups.reduce((acc, group) => {
    if (group?.id) acc[group.id] = group;
    return acc;
  }, {});

const mergeSharedGroup = (entry, group) => {
  if (!group?.id) return;
  if (!entry.sharedGroups.some((item) => item.id === group.id)) {
    entry.sharedGroups.push({
      id: group.id,
      name: group.name || "Group",
      emoji: group.emoji || "👥",
    });
  }
};

const mergeGroupBalance = (entry, group, balance) => {
  if (!group?.id) return;
  const nextAmount = Number(balance?.netBalance || 0);
  const existing = entry.groupBalances.find(
    (item) => item.groupId === group.id,
  );

  if (existing) {
    existing.netBalance = Number((existing.netBalance + nextAmount).toFixed(2));
    return;
  }

  entry.groupBalances.push({
    groupId: group.id,
    groupName: group.name || "Group",
    groupEmoji: group.emoji || "👥",
    netBalance: Number(nextAmount.toFixed(2)),
  });
};

const mergeBalanceEntry = (target, incoming) => {
  target.netBalance = Number(
    (target.netBalance + Number(incoming.netBalance || 0)).toFixed(2),
  );
  target.totalOwedToYou = Number(
    (target.totalOwedToYou + Number(incoming.totalOwedToYou || 0)).toFixed(2),
  );
  target.totalYouOwe = Number(
    (target.totalYouOwe + Number(incoming.totalYouOwe || 0)).toFixed(2),
  );
  target.sharedExpenses += Number(incoming.sharedExpenses || 0);
};

const createBaseAggregate = (balance) => ({
  userId: balance.userId,
  name: balance.name,
  phone: balance.phone,
  photoUrl: balance.photoUrl || "",
  upiId: balance.upiId || "",
  netBalance: 0,
  totalOwedToYou: 0,
  totalYouOwe: 0,
  sharedExpenses: 0,
  sharedGroups: [],
  groupBalances: [],
  latestGroupId: null,
  latestGroupName: "",
});

const getBalanceServiceErrorMessage = (
  error,
  fallback = "Balance service request failed.",
) => {
  if (error?.code === "PGRST205") {
    return "Required Supabase table is missing. Run the latest migration.";
  }
  return error?.message || fallback;
};

const createNotificationRecord = async (userId, actorId, payload) => {
  const { error } = await supabase.from(NOTIFICATIONS_TABLE).insert({
    userId,
    actorId,
    ...payload,
    read: false,
    createdAt: new Date().toISOString(),
  });
  if (error) throw error;
};

/*
|------------------------------------------------------------------
| getUserBalancesInGroup
|------------------------------------------------------------------
| Returns per-user balances for a single group.
*/
export const getUserBalancesInGroup = async (groupId, currentUserId) => {
  try {
    const [expensesResult, groupsResult, settlementsResult] = await Promise.all(
      [
        getGroupExpensesOnce(groupId),
        getUserGroupsOnce(currentUserId),
        getSettlements(groupId),
      ],
    );

    if (!expensesResult.success) throw new Error(expensesResult.error);
    if (!groupsResult.success) throw new Error(groupsResult.error);
    if (!settlementsResult.success) throw new Error(settlementsResult.error);

    const group = (groupsResult.groups || []).find((g) => g.id === groupId);
    if (!group) throw new Error("Group not found.");

    const membersResult = await getUsersByIds(group.members || []);
    if (!membersResult.success) throw new Error(membersResult.error);

    const groupEmoji = group.emoji || "👥";

    const balances = calculatePerUserBalances(
      expensesResult.expenses || [],
      currentUserId,
      membersResult.users || [],
      settlementsResult.settlements || [],
    ).map((balance) => ({
      ...balance,
      sharedGroups: [
        { id: group.id, name: group.name || "Group", emoji: groupEmoji },
      ],
      groupBalances: [
        {
          groupId: group.id,
          groupName: group.name || "Group",
          groupEmoji,
          netBalance: Number(balance.netBalance || 0),
        },
      ],
      latestGroupId: group.id,
      latestGroupName: group.name || "Group",
    }));

    return { success: true, balances };
  } catch (error) {
    console.error("Get user balances in group error:", error);
    return {
      success: false,
      error: getBalanceServiceErrorMessage(
        error,
        "Failed to fetch group balances",
      ),
    };
  }
};

/*
|------------------------------------------------------------------
| getUserBalancesAcrossAllGroups
|------------------------------------------------------------------
| Returns per-user balances merged across ALL groups.
| Same person in multiple groups → one combined entry.
| This is the source of truth for BalanceBreakdownScreen.
*/
export const getUserBalancesAcrossAllGroups = async (currentUserId) => {
  try {
    const groupsResult = await getUserGroupsOnce(currentUserId);
    if (!groupsResult.success) throw new Error(groupsResult.error);

    const groups = groupsResult.groups || [];
    if (!groups.length) return { success: true, balances: [] };

    const [expensesResults, settlementsResults, membersResult] =
      await Promise.all([
        Promise.all(groups.map((g) => getGroupExpensesOnce(g.id))),
        Promise.all(groups.map((g) => getSettlements(g.id))),
        getUsersByIds(
          [...new Set(groups.flatMap((g) => g.members || []))].filter(Boolean),
        ),
      ]);

    const failedExpense = expensesResults.find((r) => !r.success);
    if (failedExpense) throw new Error(failedExpense.error);

    const failedSettlement = settlementsResults.find((r) => !r.success);
    if (failedSettlement) throw new Error(failedSettlement.error);

    if (!membersResult.success) throw new Error(membersResult.error);

    const members = membersResult.users || [];
    const aggregate = {};
    const groupLookup = buildGroupLookup(groups);

    groups.forEach((group, index) => {
      const groupExpenses = expensesResults[index]?.expenses || [];
      const groupSettlements = settlementsResults[index]?.settlements || [];
      const memberIds = new Set(group.members || []);
      const groupMembers = members.filter((m) => memberIds.has(m.id));

      const perGroupBalances = calculatePerUserBalances(
        groupExpenses,
        currentUserId,
        groupMembers,
        groupSettlements,
      );

      perGroupBalances.forEach((balance) => {
        if (!aggregate[balance.userId]) {
          aggregate[balance.userId] = createBaseAggregate(balance);
        }

        mergeBalanceEntry(aggregate[balance.userId], balance);
        mergeSharedGroup(aggregate[balance.userId], groupLookup[group.id]);
        mergeGroupBalance(
          aggregate[balance.userId],
          groupLookup[group.id],
          balance,
        );

        if (!aggregate[balance.userId].latestGroupId) {
          aggregate[balance.userId].latestGroupId = group.id;
          aggregate[balance.userId].latestGroupName = group.name || "Group";
        }
      });
    });

    // Recalculate totalOwedToYou / totalYouOwe from final netBalance
    const balances = Object.values(aggregate)
      .map((entry) => ({
        ...entry,
        totalOwedToYou: Number(Math.max(entry.netBalance, 0).toFixed(2)),
        totalYouOwe: Number(Math.max(entry.netBalance * -1, 0).toFixed(2)),
      }))
      .sort((a, b) => {
        const diff = Math.abs(b.netBalance) - Math.abs(a.netBalance);
        if (diff !== 0) return diff;
        return a.name.localeCompare(b.name);
      });

    return { success: true, balances };
  } catch (error) {
    console.error("Get user balances across all groups error:", error);
    return {
      success: false,
      error: getBalanceServiceErrorMessage(error, "Failed to fetch balances"),
    };
  }
};

/*
|------------------------------------------------------------------
| recordSettlement
|------------------------------------------------------------------
| Saves a settlement to Supabase and notifies the receiver.
*/
export const recordSettlement = async (
  groupId,
  payerId,
  receiverId,
  amount,
  meta = {},
) => {
  try {
    if (!groupId || !payerId || !receiverId) {
      throw new Error("Group, payer, and receiver are required.");
    }

    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      throw new Error("Settlement amount must be greater than zero.");
    }

    const payload = {
      groupId,
      paidBy: payerId,
      paidTo: receiverId,
      amount: Number(numericAmount.toFixed(2)),
      createdAt: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from(SETTLEMENTS_TABLE)
      .insert(payload)
      .select("*")
      .single();

    if (error) throw error;

    const payerName = meta.payerName || "Someone";
    const amountText = formatCurrency(payload.amount);

    // Save in-app notification
    await createNotificationRecord(receiverId, payerId, {
      type: "settlement",
      title: "Payment Received 💰",
      message: `${payerName} paid you ${amountText}`,
      groupId,
      metadata: {
        amount: payload.amount,
        actorName: payerName,
        groupName: meta.groupName || "your group",
      },
    });

    // Send push notification (guarded — won't crash if session not ready)
    await safeSendPush([receiverId], {
      title: "Payment Received 💰",
      body: `${payerName} paid you ${amountText}`,
      data: { type: "settlement", amount: payload.amount, groupId },
    });

    await updateGroupActivity(groupId);

    return { success: true, settlement: data };
  } catch (error) {
    console.error("Record settlement error:", error);
    return {
      success: false,
      error: getBalanceServiceErrorMessage(
        error,
        "Failed to record settlement",
      ),
    };
  }
};

/*
|------------------------------------------------------------------
| getSettlements
|------------------------------------------------------------------
| Fetches all settlements for a group.
*/
export const getSettlements = async (groupId) => {
  try {
    const { data, error } = await supabase
      .from(SETTLEMENTS_TABLE)
      .select("*")
      .eq("groupId", groupId)
      .order("createdAt", { ascending: false });

    if (error) throw error;

    return { success: true, settlements: data || [] };
  } catch (error) {
    console.error("Get settlements error:", error);
    return {
      success: false,
      error: getBalanceServiceErrorMessage(
        error,
        "Failed to fetch settlements",
      ),
    };
  }
};

/*
|------------------------------------------------------------------
| sendBalanceReminder
|------------------------------------------------------------------
| Sends a push notification reminder to someone who owes you.
| Falls back to SMS if push token not available.
*/
export const sendBalanceReminder = async (
  targetUser,
  currentUser,
  amount,
  groupId,
  groupName = "your group",
) => {
  try {
    if (!targetUser?.userId) {
      throw new Error("A recipient is required.");
    }

    const formattedAmount = formatCurrency(amount);
    const senderName =
      currentUser?.name ||
      currentUser?.phone ||
      currentUser?.phoneNumber ||
      "Someone";

    // Save in-app notification
    await createNotificationRecord(targetUser.userId, currentUser?.id, {
      type: "payment_reminder",
      title: "Payment Reminder 💸",
      message: `${senderName} is waiting for ${formattedAmount}`,
      groupId,
      metadata: {
        amount: Number(amount),
        actorName: senderName,
        groupName,
      },
    });

    // Send push (guarded)
    let pushSent = 0;
    try {
      await requireSession();
      const pushResult = await sendPushNotificationsToUsers(
        [targetUser.userId],
        {
          title: "Payment Reminder 💸",
          body: `${senderName} is waiting for ${formattedAmount}`,
          data: { type: "payment_reminder", amount: Number(amount), groupId },
        },
      );
      pushSent = Number(pushResult?.sent || 0);
    } catch (pushError) {
      console.warn("Push skipped:", pushError.message);
    }

    return {
      success: true,
      sentPush: pushSent,
      needsSmsFallback: pushSent === 0,
      smsBody: `Hey! You owe me ${formattedAmount} on SplitMate. Please settle up 🙏`,
    };
  } catch (error) {
    console.error("Send balance reminder error:", error);
    return {
      success: false,
      error: getBalanceServiceErrorMessage(error, "Failed to send reminder"),
    };
  }
};
