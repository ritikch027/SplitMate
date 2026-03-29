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

const buildGroupLookup = (groups = []) =>
  groups.reduce((acc, group) => {
    if (group?.id) {
      acc[group.id] = group;
    }
    return acc;
  }, {});

const mergeSharedGroup = (entry, group) => {
  if (!group?.id) return;

  if (!entry.sharedGroups.some((item) => item.id === group.id)) {
    entry.sharedGroups.push({
      id: group.id,
      name: group.name || "Group",
      emoji: group.emoji || "G",
    });
  }
};

const mergeGroupBalance = (entry, group, balance) => {
  if (!group?.id) return;

  const nextAmount = Number(balance?.netBalance || 0);
  const existing = entry.groupBalances.find((item) => item.groupId === group.id);

  if (existing) {
    existing.netBalance = Number((existing.netBalance + nextAmount).toFixed(2));
    return;
  }

  entry.groupBalances.push({
    groupId: group.id,
    groupName: group.name || "Group",
    groupEmoji: group.emoji || "G",
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
    return "The required Supabase table is missing. Run the latest migration and refresh the schema cache.";
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

export const getUserBalancesInGroup = async (groupId, currentUserId) => {
  try {
    const [expensesResult, groupsResult, settlementsResult] = await Promise.all([
      getGroupExpensesOnce(groupId),
      getUserGroupsOnce(currentUserId),
      getSettlements(groupId),
    ]);

    if (!expensesResult.success) {
      throw new Error(expensesResult.error || "Unable to load expenses.");
    }

    if (!groupsResult.success) {
      throw new Error(groupsResult.error || "Unable to load groups.");
    }

    if (!settlementsResult.success) {
      throw new Error(settlementsResult.error || "Unable to load settlements.");
    }

    const group = (groupsResult.groups || []).find((item) => item.id === groupId);
    if (!group) {
      throw new Error("Group not found.");
    }

    const membersResult = await getUsersByIds(group.members || []);
    if (!membersResult.success) {
      throw new Error(membersResult.error || "Unable to load group members.");
    }

    const groupEmoji = group.emoji || "G";
    const balances = calculatePerUserBalances(
      expensesResult.expenses || [],
      currentUserId,
      membersResult.users || [],
      settlementsResult.settlements || [],
    ).map((balance) => ({
      ...balance,
      sharedGroups: [{ id: group.id, name: group.name || "Group", emoji: groupEmoji }],
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
        "Failed to fetch balances for this group",
      ),
    };
  }
};

export const getUserBalancesAcrossAllGroups = async (currentUserId) => {
  try {
    const groupsResult = await getUserGroupsOnce(currentUserId);

    if (!groupsResult.success) {
      throw new Error(groupsResult.error || "Unable to load groups.");
    }

    const groups = groupsResult.groups || [];
    if (!groups.length) {
      return { success: true, balances: [] };
    }

    const [expensesResults, settlementsResults, membersResult] = await Promise.all([
      Promise.all(groups.map((group) => getGroupExpensesOnce(group.id))),
      Promise.all(groups.map((group) => getSettlements(group.id))),
      getUsersByIds(
        [...new Set(groups.flatMap((group) => group.members || []))].filter(Boolean),
      ),
    ]);

    const failedExpenseResult = expensesResults.find((result) => !result.success);
    if (failedExpenseResult) {
      throw new Error(failedExpenseResult.error || "Unable to load expenses.");
    }

    const failedSettlementResult = settlementsResults.find((result) => !result.success);
    if (failedSettlementResult) {
      throw new Error(failedSettlementResult.error || "Unable to load settlements.");
    }

    if (!membersResult.success) {
      throw new Error(membersResult.error || "Unable to load group members.");
    }

    const members = membersResult.users || [];
    const aggregate = {};
    const groupLookup = buildGroupLookup(groups);

    groups.forEach((group, index) => {
      const groupExpenses = expensesResults[index]?.expenses || [];
      const groupSettlements = settlementsResults[index]?.settlements || [];
      const memberIds = new Set(group.members || []);
      const groupMembers = members.filter((member) => memberIds.has(member.id));
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
        mergeGroupBalance(aggregate[balance.userId], groupLookup[group.id], balance);

        if (!aggregate[balance.userId].latestGroupId) {
          aggregate[balance.userId].latestGroupId = group.id;
          aggregate[balance.userId].latestGroupName = group.name || "Group";
        }
      });
    });

    const balances = Object.values(aggregate).sort((left, right) => {
      const leftAbs = Math.abs(left.netBalance);
      const rightAbs = Math.abs(right.netBalance);

      if (rightAbs !== leftAbs) return rightAbs - leftAbs;
      return left.name.localeCompare(right.name);
    });

    return { success: true, balances };
  } catch (error) {
    console.error("Get user balances across all groups error:", error);
    return {
      success: false,
      error: getBalanceServiceErrorMessage(
        error,
        "Failed to fetch balances across groups",
      ),
    };
  }
};

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

    const settlementPayload = {
      groupId,
      paidBy: payerId,
      paidTo: receiverId,
      amount: Number(numericAmount.toFixed(2)),
      createdAt: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from(SETTLEMENTS_TABLE)
      .insert(settlementPayload)
      .select("*")
      .single();

    if (error) throw error;

    const payerName = meta.payerName || "Someone";
    const groupName = meta.groupName || "your group";
    const amountText = formatCurrency(settlementPayload.amount);

    await createNotificationRecord(receiverId, payerId, {
      type: "settlement",
      title: "Payment Received",
      message: `${payerName} paid you ${amountText}`,
      groupId,
      metadata: {
        amount: settlementPayload.amount,
        actorName: payerName,
        groupName,
        reason: "Settlement recorded",
      },
    });

    await sendPushNotificationsToUsers([receiverId], {
      title: "Payment Received",
      body: `${payerName} paid you ${amountText}`,
      data: {
        type: "settlement",
        amount: settlementPayload.amount,
        groupId,
      },
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
      currentUser?.name || currentUser?.phone || currentUser?.phoneNumber || "Someone";

    const pushResult = await sendPushNotificationsToUsers([targetUser.userId], {
      title: "Payment Reminder",
      body: `${senderName} is waiting for ${formattedAmount}`,
      data: {
        type: "payment_reminder",
        amount: Number(amount),
        groupId,
      },
    });

    await createNotificationRecord(targetUser.userId, currentUser?.uid, {
      type: "payment_reminder",
      title: "Payment Reminder",
      message: `${senderName} is waiting for ${formattedAmount}`,
      groupId,
      metadata: {
        amount: Number(amount),
        actorName: senderName,
        groupName,
        reason: "Settlement reminder",
      },
    });

    return {
      success: true,
      sentPush: Number(pushResult?.sent || 0),
      needsSmsFallback: Number(pushResult?.sent || 0) === 0,
      smsBody: `Hey! You owe me ${formattedAmount} on SplitMate. Please settle up.`,
    };
  } catch (error) {
    console.error("Send balance reminder error:", error);
    return {
      success: false,
      error: getBalanceServiceErrorMessage(
        error,
        "Failed to send reminder",
      ),
    };
  }
};
