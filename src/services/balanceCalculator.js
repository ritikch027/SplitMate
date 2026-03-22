/*
|--------------------------------------------------------------------------
| balanceCalculator.js
|--------------------------------------------------------------------------
| Utility functions for calculating balances between users in a group.
|
| These functions are PURE:
| - No Firebase
| - No external dependencies
| - Deterministic output
|
| Used by SplitMate to:
| - calculate who owes whom
| - simplify debts
| - compute totals
| - format currency
*/

/*
|--------------------------------------------------------------------------
| calculateBalances(expenses, members, currentUserId)
|--------------------------------------------------------------------------
| Calculates net balances between current user and group members.
|
| Logic:
| 1. Person who paid gets credit for full amount
| 2. Each person in splitBetween owes equal share
| 3. share = amount / splitBetween.length
|
| Positive balance:
|   Others owe current user
|
| Negative balance:
|   Current user owes them
|
| Example Input:
|
| expenses = [
|   {
|     amount: 900,
|     paidBy: "A",
|     splitBetween: ["A","B","C"]
|   }
| ]
|
| currentUserId = "A"
|
| Result:
| [
|   { userId: "B", name: "B", netBalance: 300 },
|   { userId: "C", name: "C", netBalance: 300 }
| ]
|
*/

export const calculateBalances = (expenses, members, currentUserId) => {
  const balances = {};

  // Initialize balances
  members.forEach((member) => {
    if (member.id !== currentUserId) {
      balances[member.id] = 0;
    }
  });

  expenses.forEach((expense) => {
    const share = expense.amount / expense.splitBetween.length;

    expense.splitBetween.forEach((userId) => {
      // If current user paid
      if (expense.paidBy === currentUserId && userId !== currentUserId) {
        balances[userId] += share;
      }

      // If another user paid and current user owes
      if (userId === currentUserId && expense.paidBy !== currentUserId) {
        balances[expense.paidBy] -= share;
      }
    });
  });

  // Convert object → array format
  return Object.keys(balances).map((userId) => {
    const member = members.find((m) => m.id === userId);

    return {
      userId,
      name: member?.name || "Unknown",
      netBalance: Number(balances[userId].toFixed(2)),
    };
  });
};

/*
|--------------------------------------------------------------------------
| simplifyDebts(balances)
|--------------------------------------------------------------------------
| Minimizes number of transactions required to settle debts.
|
| Classic debt simplification algorithm:
| 1. Separate creditors (+) and debtors (-)
| 2. Match largest creditor with largest debtor
| 3. Transfer minimum amount
| 4. Repeat until settled
|
| Example Input:
|
| balances = [
|   { userId:"A", netBalance:-100 },
|   { userId:"B", netBalance:50 },
|   { userId:"C", netBalance:50 }
| ]
|
| Output:
|
| [
|   { from:"A", to:"B", amount:50 },
|   { from:"A", to:"C", amount:50 }
| ]
|
*/

export const simplifyDebts = (balances) => {
  const creditors = [];
  const debtors = [];

  balances.forEach((b) => {
    if (b.netBalance > 0) creditors.push({ ...b });
    if (b.netBalance < 0) debtors.push({ ...b });
  });

  const transactions = [];

  let i = 0;
  let j = 0;

  while (i < creditors.length && j < debtors.length) {
    const credit = creditors[i];
    const debt = debtors[j];

    const amount = Math.min(credit.netBalance, -debt.netBalance);

    transactions.push({
      from: debt.userId,
      to: credit.userId,
      amount: Number(amount.toFixed(2)),
    });

    credit.netBalance -= amount;
    debt.netBalance += amount;

    if (credit.netBalance === 0) i++;
    if (debt.netBalance === 0) j++;
  }

  return transactions;
};

/*
|--------------------------------------------------------------------------
| getTotalOwed(balances)
|--------------------------------------------------------------------------
| Returns total amount others owe the current user.
|
| Example:
|
| balances = [
|   { netBalance:200 },
|   { netBalance:-100 },
|   { netBalance:50 }
| ]
|
| Result = 250
|
*/

export const getTotalOwed = (balances) => {
  return balances
    .filter((b) => b.netBalance > 0)
    .reduce((sum, b) => sum + b.netBalance, 0);
};

/*
|--------------------------------------------------------------------------
| getTotalOwe(balances)
|--------------------------------------------------------------------------
| Returns total amount current user owes others.
|
| Example:
|
| balances = [
|   { netBalance:200 },
|   { netBalance:-100 },
|   { netBalance:-50 }
| ]
|
| Result = 150
|
*/

export const getTotalOwe = (balances) => {
  return Math.abs(
    balances
      .filter((b) => b.netBalance < 0)
      .reduce((sum, b) => sum + b.netBalance, 0),
  );
};

/*
|--------------------------------------------------------------------------
| formatCurrency(amount)
|--------------------------------------------------------------------------
| Formats number into Indian Rupee format.
|
| Examples:
|
| formatCurrency(100000)
| → "₹1,00,000"
|
| formatCurrency(1500.5)
| → "₹1,500.50"
|
*/

export const formatCurrency = (amount) => {
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch (_error) {
    return `₹${amount}`;
  }
};
