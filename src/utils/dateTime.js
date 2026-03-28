const isValidDate = (value) => value instanceof Date && !Number.isNaN(value.getTime());

export const parseDateTime = (value) => {
  if (!value) return null;

  if (typeof value?.toDate === "function") {
    return parseDateTime(value.toDate());
  }

  if (isValidDate(value)) {
    return value;
  }

  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    return isValidDate(parsed) ? parsed : null;
  }

  return null;
};

const isSameDay = (left, right) =>
  left.getFullYear() === right.getFullYear() &&
  left.getMonth() === right.getMonth() &&
  left.getDate() === right.getDate();

export const formatTimeLabel = (value) => {
  const date = parseDateTime(value);
  if (!date) return "Recently";

  return date.toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
  });
};

export const formatDateLabel = (value) => {
  const date = parseDateTime(value);
  if (!date) return "Recently";

  const now = new Date();
  const sameYear = date.getFullYear() === now.getFullYear();

  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
  });
};

export const formatRecentTimestamp = (value) => {
  const date = parseDateTime(value);
  if (!date) return "Recently";

  return isSameDay(date, new Date()) ? formatTimeLabel(date) : formatDateLabel(date);
};

export const formatActivitySectionLabel = (value) => {
  const date = parseDateTime(value);
  if (!date) return "Recently";

  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (isSameDay(date, today)) return "Today";
  if (isSameDay(date, yesterday)) return "Yesterday";

  return formatDateLabel(date);
};
