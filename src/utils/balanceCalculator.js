/*
|--------------------------------------------------------------------------
| balanceCalculator.js
|--------------------------------------------------------------------------
| Pure balance helpers shared across the app.
|
| Positive balance:
|   The other person owes the current user.
|
| Negative balance:
|   The current user owes the other person.
*/

const roundAmount = (value) => Number(Number(value || 0).toFixed(2));

const getMemberId = (member) => {
  if (typeof member === "string") return member;
  return member?.id || null;
};

const getMemberName = (member) => {
  if (typeof member === "string") return member;
  return member?.name || member?.phone || "Unknown";
};

const getMemberPhone = (member) => {
  if (typeof member === "string") return "";
  return member?.phone || "";
};

const getMemberPhoto = (member) => {
  if (typeof member === "string") return "";
  return member?.photoUrl || "";
};

const getMemberUpiId = (member) => {
  if (typeof member === "string") return "";
  return member?.upiId || "";
};

const buildMemberLookup = (members = []) =>
  members.reduce((acc, member) => {
    const memberId = getMemberId(member);
    if (!memberId) return acc;

    acc[memberId] = member;
    return acc;
  }, {});

export const getExpenseShareForUser = (expense, userId) => {
  const customShare = Number(expense?.splits?.[userId]);

  if (Number.isFinite(customShare) && customShare >= 0) {
    return roundAmount(customShare);
  }

  const participantCount = Array.isArray(expense?.splitBetween)
    ? expense.splitBetween.length
    : 0;

  if (!participantCount) {
    return 0;
  }

  return roundAmount(Number(expense?.amount || 0) / participantCount);
};

/*
|--------------------------------------------------------------------------
| calculatePerUserBalances
|--------------------------------------------------------------------------
| Aggregates balances between the current user and every other member.
*/
export const calculatePerUserBalances = (
  expenses = [],
  currentUserId,
  members = [],
  settlements = [],
) => {
  const memberLookup = buildMemberLookup(members);
  const balances = {};

  members.forEach((member) => {
    const memberId = getMemberId(member);
    if (!memberId || memberId === currentUserId) return;

    balances[memberId] = {
      userId: memberId,
      name: getMemberName(member),
      phone: getMemberPhone(member),
      photoUrl: getMemberPhoto(member),
      upiId: getMemberUpiId(member),
      netBalance: 0,
      totalOwedToYou: 0,
      totalYouOwe: 0,
      sharedExpenses: 0,
    };
  });

  expenses.forEach((expense) => {
    const splitBetween = Array.isArray(expense?.splitBetween)
      ? expense.splitBetween.filter(Boolean)
      : [];

    if (!splitBetween.length || !splitBetween.includes(currentUserId)) {
      return;
    }

    if (expense.paidBy === currentUserId) {
      splitBetween.forEach((userId) => {
        if (userId === currentUserId) return;

        if (!balances[userId]) {
          const member = memberLookup[userId];
          balances[userId] = {
            userId,
            name: getMemberName(member),
            phone: getMemberPhone(member),
            photoUrl: getMemberPhoto(member),
            upiId: getMemberUpiId(member),
            netBalance: 0,
            totalOwedToYou: 0,
            totalYouOwe: 0,
            sharedExpenses: 0,
          };
        }

        const share = getExpenseShareForUser(expense, userId);
        balances[userId].netBalance = roundAmount(
          balances[userId].netBalance + share,
        );
        balances[userId].totalOwedToYou = roundAmount(
          balances[userId].totalOwedToYou + share,
        );
        balances[userId].sharedExpenses += 1;
      });

      return;
    }

    const payerId = expense.paidBy;
    if (!payerId || payerId === currentUserId) return;

    if (!balances[payerId]) {
      const member = memberLookup[payerId];
      balances[payerId] = {
        userId: payerId,
        name: getMemberName(member),
        phone: getMemberPhone(member),
        photoUrl: getMemberPhoto(member),
        upiId: getMemberUpiId(member),
        netBalance: 0,
        totalOwedToYou: 0,
        totalYouOwe: 0,
        sharedExpenses: 0,
      };
    }

    const share = getExpenseShareForUser(expense, currentUserId);
    balances[payerId].netBalance = roundAmount(
      balances[payerId].netBalance - share,
    );
    balances[payerId].totalYouOwe = roundAmount(
      balances[payerId].totalYouOwe + share,
    );
    balances[payerId].sharedExpenses += 1;
  });

  settlements.forEach((settlement) => {
    const amount = roundAmount(settlement?.amount);
    if (!amount) return;

    if (settlement?.paidBy === currentUserId && settlement?.paidTo) {
      const receiverId = settlement.paidTo;
      if (!balances[receiverId]) {
        const member = memberLookup[receiverId];
        balances[receiverId] = {
          userId: receiverId,
          name: getMemberName(member),
          phone: getMemberPhone(member),
          photoUrl: getMemberPhoto(member),
          upiId: getMemberUpiId(member),
          netBalance: 0,
          totalOwedToYou: 0,
          totalYouOwe: 0,
          sharedExpenses: 0,
        };
      }

      balances[receiverId].netBalance = roundAmount(
        balances[receiverId].netBalance + amount,
      );
      return;
    }

    if (settlement?.paidTo === currentUserId && settlement?.paidBy) {
      const payerId = settlement.paidBy;
      if (!balances[payerId]) {
        const member = memberLookup[payerId];
        balances[payerId] = {
          userId: payerId,
          name: getMemberName(member),
          phone: getMemberPhone(member),
          photoUrl: getMemberPhoto(member),
          upiId: getMemberUpiId(member),
          netBalance: 0,
          totalOwedToYou: 0,
          totalYouOwe: 0,
          sharedExpenses: 0,
        };
      }

      balances[payerId].netBalance = roundAmount(
        balances[payerId].netBalance - amount,
      );
    }
  });

  return Object.values(balances).map((entry) => ({
    ...entry,
    netBalance: roundAmount(entry.netBalance),
    totalOwedToYou: roundAmount(Math.max(entry.netBalance, 0)),
    totalYouOwe: roundAmount(Math.max(entry.netBalance * -1, 0)),
  }));
};

// Backwards-compatible alias used by older screens.
export const calculateBalances = (
  expenses,
  members,
  currentUserId,
  settlements = [],
) => calculatePerUserBalances(expenses, currentUserId, members, settlements);

export const simplifyDebts = (balances = []) => {
  const creditors = [];
  const debtors = [];

  balances.forEach((balance) => {
    if (balance.netBalance > 0) creditors.push({ ...balance });
    if (balance.netBalance < 0) debtors.push({ ...balance });
  });

  const transactions = [];
  let creditorIndex = 0;
  let debtorIndex = 0;

  while (creditorIndex < creditors.length && debtorIndex < debtors.length) {
    const creditor = creditors[creditorIndex];
    const debtor = debtors[debtorIndex];
    const amount = Math.min(creditor.netBalance, Math.abs(debtor.netBalance));

    transactions.push({
      from: debtor.userId,
      to: creditor.userId,
      amount: roundAmount(amount),
    });

    creditor.netBalance = roundAmount(creditor.netBalance - amount);
    debtor.netBalance = roundAmount(debtor.netBalance + amount);

    if (creditor.netBalance <= 0) creditorIndex += 1;
    if (debtor.netBalance >= 0) debtorIndex += 1;
  }

  return transactions;
};

export const getTotalOwed = (balances = []) =>
  roundAmount(
    balances
      .filter((balance) => balance.netBalance > 0)
      .reduce((sum, balance) => sum + balance.netBalance, 0),
  );

export const getTotalOwe = (balances = []) =>
  roundAmount(
    Math.abs(
      balances
        .filter((balance) => balance.netBalance < 0)
        .reduce((sum, balance) => sum + balance.netBalance, 0),
    ),
  );

export const getNetTotal = (balances = []) =>
  roundAmount(
    balances.reduce((sum, balance) => sum + Number(balance.netBalance || 0), 0),
  );

export const formatCurrency = (amount) => {
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(Number(amount || 0));
  } catch (_error) {
    return `₹${Number(amount || 0)}`;
  }
};
