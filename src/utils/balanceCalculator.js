/*
|--------------------------------------------------------------------------
| balanceCalculator.js
|--------------------------------------------------------------------------
| Pure balance helpers shared across the app.
|
| Positive netBalance:
|   The other person owes the current user.
|
| Negative netBalance:
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

/*
|--------------------------------------------------------------------------
| getExpenseShareForUser
|--------------------------------------------------------------------------
| Returns how much a user owes for a specific expense.
| Checks for custom splits first, falls back to equal split.
*/
export const getExpenseShareForUser = (expense, userId) => {
  const customShare = Number(expense?.splits?.[userId]);

  if (Number.isFinite(customShare) && customShare >= 0) {
    return roundAmount(customShare);
  }

  const participantCount = Array.isArray(expense?.splitBetween)
    ? expense.splitBetween.length
    : 0;

  if (!participantCount) return 0;

  return roundAmount(Number(expense?.amount || 0) / participantCount);
};

/*
|--------------------------------------------------------------------------
| calculatePerUserBalances
|--------------------------------------------------------------------------
| Aggregates balances between the current user and every other member.
|
| Returns one entry PER PERSON (not per group).
| Settlements are factored in to reduce outstanding balances.
*/
export const calculatePerUserBalances = (
  expenses = [],
  currentUserId,
  members = [],
  settlements = [],
) => {
  const memberLookup = buildMemberLookup(members);
  const balances = {};

  // Pre-populate all known members
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

  // Process expenses
  expenses.forEach((expense) => {
    const splitBetween = Array.isArray(expense?.splitBetween)
      ? expense.splitBetween.filter(Boolean)
      : [];

    // Skip if current user is not involved
    if (!splitBetween.length || !splitBetween.includes(currentUserId)) return;

    if (expense.paidBy === currentUserId) {
      // Current user paid — everyone else owes them their share
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
        balances[userId].sharedExpenses += 1;
      });

      return;
    }

    // Someone else paid — current user owes them their share
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
    balances[payerId].sharedExpenses += 1;
  });

  // Apply settlements to reduce outstanding balances
  settlements.forEach((settlement) => {
    const amount = roundAmount(settlement?.amount);
    if (!amount) return;

    if (settlement?.paidBy === currentUserId && settlement?.paidTo) {
      // Current user paid someone → reduces what they owe that person
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
      // Paying reduces negative balance (you owe less)
      balances[receiverId].netBalance = roundAmount(
        balances[receiverId].netBalance + amount,
      );
      return;
    }

    if (settlement?.paidTo === currentUserId && settlement?.paidBy) {
      // Someone paid current user → reduces what they owe current user
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
      // Receiving reduces positive balance (they owe you less)
      balances[payerId].netBalance = roundAmount(
        balances[payerId].netBalance - amount,
      );
    }
  });

  // Finalize — compute totalOwedToYou and totalYouOwe from netBalance
  return Object.values(balances).map((entry) => ({
    ...entry,
    netBalance: roundAmount(entry.netBalance),
    totalOwedToYou: roundAmount(Math.max(entry.netBalance, 0)),
    totalYouOwe: roundAmount(Math.max(entry.netBalance * -1, 0)),
  }));
};

/*
|--------------------------------------------------------------------------
| calculateBalances
|--------------------------------------------------------------------------
| Backwards-compatible alias used by HomeScreen and GroupDetailsScreen.
*/
export const calculateBalances = (
  expenses,
  members,
  currentUserId,
  settlements = [],
) => calculatePerUserBalances(expenses, currentUserId, members, settlements);

/*
|--------------------------------------------------------------------------
| simplifyDebts
|--------------------------------------------------------------------------
| Minimizes number of transactions needed to settle all debts.
| Classic debt simplification algorithm.
*/
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

/*
|--------------------------------------------------------------------------
| Aggregate helpers
|--------------------------------------------------------------------------
*/

// Total others owe you (sum of positive balances)
export const getTotalOwed = (balances = []) =>
  roundAmount(
    balances
      .filter((b) => b.netBalance > 0)
      .reduce((sum, b) => sum + b.netBalance, 0),
  );

// Total you owe others (sum of negative balances, returned as positive)
export const getTotalOwe = (balances = []) =>
  roundAmount(
    Math.abs(
      balances
        .filter((b) => b.netBalance < 0)
        .reduce((sum, b) => sum + b.netBalance, 0),
    ),
  );

// Net position across all balances
export const getNetTotal = (balances = []) =>
  roundAmount(balances.reduce((sum, b) => sum + Number(b.netBalance || 0), 0));

/*
|--------------------------------------------------------------------------
| formatCurrency
|--------------------------------------------------------------------------
| Formats a number as Indian Rupee string.
| Example: 100000 → ₹1,00,000
*/
export const formatCurrency = (amount) => {
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(Number(amount || 0));
  } catch {
    return `₹${Number(amount || 0)}`;
  }
};
