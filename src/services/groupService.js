import { supabase } from "../config/supabaseConfig";
import { createNotificationsForUsers } from "./notificationService";
import { enforceCooldown } from "../utils/rateLimit";

const CREATE_GROUP_COOLDOWN_MS = 3 * 1000;
const GROUPS_TABLE = "groups";

const getGroupServiceErrorMessage = (
  error,
  fallback = "Group service request failed.",
) => {
  if (error?.code === "PGRST205") {
    return "The Supabase 'groups' table is missing. Create public.groups and refresh the schema cache.";
  }

  return error?.message || fallback;
};

const sanitizeGroupName = (name) => {
  const cleaned = String(name || "")
    .replace(/\s+/g, " ")
    .trim();

  if (cleaned.length < 2) {
    throw new Error("Group name must be at least 2 characters.");
  }

  if (cleaned.length > 50) {
    throw new Error("Group name must be 50 characters or fewer.");
  }

  return cleaned;
};

const sortGroupsByActivity = (items = []) =>
  [...items].sort((a, b) => {
    const aTime = new Date(a?.lastActivity || a?.createdAt || 0).getTime();
    const bTime = new Date(b?.lastActivity || b?.createdAt || 0).getTime();
    return bTime - aTime;
  });

const buildGroupNotificationMessage = (actorName, groupName, action) =>
  `${actorName || "Someone"} ${action} ${groupName || "this group"}.`;

/*
|--------------------------------------------------------------------------
| createGroup(name, emoji, memberIds, createdBy)
|--------------------------------------------------------------------------
| Creates a new group document in Supabase.
|
| Structure:
| groups table
| {
|   id,
|   name,
|   emoji,
|   members: [],
|   createdBy,
|   createdAt,
|   lastActivity
| }
|
| Note:
| We intentionally keep the group document as the source of truth
| for membership. Updating other users' documents from the client
| would require cross-user write permissions and is blocked by
| safer Supabase RLS policies.
*/
export const createGroup = async (
  name,
  emoji,
  memberIds,
  createdBy,
  actorName = "Someone",
) => {
  try {
    const uniqueMemberIds = [
      ...new Set([...(memberIds || []), createdBy].filter(Boolean)),
    ];
    if (uniqueMemberIds.length === 0 || uniqueMemberIds.length > 25) {
      throw new Error("Groups must have between 1 and 25 members.");
    }

    sanitizeGroupName(name);

    const cooldown = enforceCooldown(
      `create-group:${createdBy}`,
      CREATE_GROUP_COOLDOWN_MS,
    );
    if (!cooldown.allowed) {
      throw new Error("Please wait a moment before creating another group.");
    }

    const groupData = {
      name: sanitizeGroupName(name),
      emoji: String(emoji || "👥").slice(0, 2),
      members: uniqueMemberIds,
      createdBy,
      createdAt: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from(GROUPS_TABLE)
      .insert(groupData)
      .select()
      .single();

    if (error) throw error;

    await createNotificationsForUsers(
      uniqueMemberIds,
      {
        type: "group_created",
        title: groupData.name,
        message: buildGroupNotificationMessage(
          actorName,
          groupData.name,
          "created",
        ),
        groupId: data.id,
        metadata: {
          emoji: groupData.emoji,
          groupName: groupData.name,
          actorName,
          reason: "Group created",
        },
      },
      createdBy,
    );

    return {
      success: true,
      groupId: data.id,
    };
  } catch (error) {
    console.error("Create group error:", error);

    return {
      success: false,
      error: getGroupServiceErrorMessage(error, "Failed to create group"),
    };
  }
};

/*
|--------------------------------------------------------------------------
| getGroup(groupId)
|--------------------------------------------------------------------------
| Fetch a single group document.
*/
export const getGroup = async (groupId) => {
  try {
    const { data, error } = await supabase
      .from(GROUPS_TABLE)
      .select("*")
      .eq("id", groupId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return {
          success: false,
          error: "Group not found",
        };
      }
      throw error;
    }

    return {
      success: true,
      group: data,
    };
  } catch (error) {
    console.error("Get group error:", error);

    return {
      success: false,
      error: getGroupServiceErrorMessage(error, "Failed to fetch group"),
    };
  }
};

/*
|--------------------------------------------------------------------------
| getUserGroups(userId, onUpdate)
|--------------------------------------------------------------------------
| Real-time listener for groups where the user is a member.
|
| Supabase query:
| groups where members array contains userId
|
| onUpdate(groups) will be called whenever group data changes.
|
| Returns unsubscribe function to stop listening.
*/
export const getUserGroups = (userId, onUpdate) => {
  try {
    const channel = supabase
      .channel(`user-groups-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "groups",
          filter: `members@>${JSON.stringify([userId])}`, // PostgreSQL array contains
        },
        () => {
          // Re-fetch all groups for the user when there's a change
          supabase
            .from(GROUPS_TABLE)
            .select("*")
            .contains("members", [userId])
            .then(({ data, error }) => {
              if (error) {
                console.error(
                  "Error fetching user groups:",
                  getGroupServiceErrorMessage(error),
                  error,
                );
                return;
              }
              onUpdate(sortGroupsByActivity(data || []));
            });
        },
      )
      .subscribe();

    // Initial fetch
    supabase
      .from(GROUPS_TABLE)
      .select("*")
      .contains("members", [userId])
      .then(({ data, error }) => {
        if (error) {
          console.error(
            "Error fetching user groups:",
            getGroupServiceErrorMessage(error),
            error,
          );
          return;
        }
        onUpdate(sortGroupsByActivity(data || []));
      });

    return () => {
      supabase.removeChannel(channel);
    };
  } catch (error) {
    console.error("Group listener error:", error);

    return () => {};
  }
};

/*
|--------------------------------------------------------------------------
| addMemberToGroup(groupId, userId)
|--------------------------------------------------------------------------
| Adds a new user to an existing group.
|
| Steps:
| 1. Add userId to group members array
| 2. Add groupId to user's groups array
|
| Uses array operations to prevent duplicates.
*/
export const addMemberToGroup = async (
  groupId,
  userId,
  actorId,
  actorName = "Someone",
) => {
  try {
    if (!groupId || !userId) {
      throw new Error("Group ID and user ID are required.");
    }

    // Get current group
    const { data: group, error: fetchError } = await supabase
      .from(GROUPS_TABLE)
      .select("name, members")
      .eq("id", groupId)
      .single();

    if (fetchError) throw fetchError;

    const currentMembers = group.members || [];
    if (currentMembers.includes(userId)) {
      return { success: true }; // Already a member
    }

    const updatedMembers = [...currentMembers, userId];

    const { error } = await supabase
      .from(GROUPS_TABLE)
      .update({
        members: updatedMembers,
        lastActivity: new Date().toISOString(),
      })
      .eq("id", groupId);

    if (error) throw error;

    await createNotificationsForUsers(
      [userId],
      {
        type: "group_member_added",
        title: "Added to a group",
        message: buildGroupNotificationMessage(
          actorName,
          group.name || "a group",
          "added you to",
        ),
        groupId,
        metadata: {
          groupName: group.name || "",
          memberId: userId,
          actorName,
          reason: "Member added",
        },
      },
      actorId || userId,
    );

    await createNotificationsForUsers(
      updatedMembers.filter((memberId) => memberId !== userId),
      {
        type: "group_member_joined",
        title: "Group updated",
        message: buildGroupNotificationMessage(
          actorName,
          group.name || "your group",
          "added a new member to",
        ),
        groupId,
        metadata: {
          groupName: group.name || "",
          memberId: userId,
          actorName,
          reason: "Member joined",
        },
      },
      actorId || userId,
    );

    return { success: true };
  } catch (error) {
    console.error("Add member error:", error);

    return {
      success: false,
      error: getGroupServiceErrorMessage(
        error,
        "Failed to add member to group",
      ),
    };
  }
};

export const getUserGroupsOnce = async (userId) => {
  try {
    const { data, error } = await supabase
      .from(GROUPS_TABLE)
      .select("*")
      .contains("members", [userId]);

    if (error) throw error;

    return {
      success: true,
      groups: sortGroupsByActivity(data || []),
    };
  } catch (error) {
    console.error("Get user groups once error:", error);
    return {
      success: false,
      error: getGroupServiceErrorMessage(error, "Failed to fetch groups"),
    };
  }
};

/*
|--------------------------------------------------------------------------
| updateGroupActivity(groupId)
|--------------------------------------------------------------------------
| Updates lastActivity timestamp.
|
| Called whenever:
| - new expense added
| - settlement occurs
|
| Used to sort groups by recent activity.
*/
export const updateGroupActivity = async (groupId) => {
  try {
    const { error } = await supabase
      .from(GROUPS_TABLE)
      .update({
        lastActivity: new Date().toISOString(),
      })
      .eq("id", groupId);

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error("Update activity error:", error);

    return {
      success: false,
      error: getGroupServiceErrorMessage(
        error,
        "Failed to update group activity",
      ),
    };
  }
};

export const removeMemberFromGroup = async (
  groupId,
  userId,
  actorId,
  actorName = "Someone",
) => {
  try {
    if (!groupId || !userId) {
      throw new Error("Group ID and user ID are required.");
    }

    // Get current group
    const { data: group, error: fetchError } = await supabase
      .from(GROUPS_TABLE)
      .select("name, members")
      .eq("id", groupId)
      .single();

    if (fetchError) throw fetchError;

    const currentMembers = group.members || [];
    const updatedMembers = currentMembers.filter((id) => id !== userId);

    const { error } = await supabase
      .from(GROUPS_TABLE)
      .update({
        members: updatedMembers,
        lastActivity: new Date().toISOString(),
      })
      .eq("id", groupId);

    if (error) throw error;

    await createNotificationsForUsers(
      [userId],
      {
        type: "group_member_removed",
        title: "Removed from group",
        message: buildGroupNotificationMessage(
          actorName,
          group.name || "a group",
          "removed you from",
        ),
        groupId,
        metadata: {
          groupName: group.name || "",
          memberId: userId,
          actorName,
          reason: "Member removed",
        },
      },
      actorId || userId,
    );

    await createNotificationsForUsers(
      updatedMembers,
      {
        type: "group_member_left",
        title: "Group updated",
        message: buildGroupNotificationMessage(
          actorName,
          group.name || "your group",
          "removed a member from",
        ),
        groupId,
        metadata: {
          groupName: group.name || "",
          memberId: userId,
          actorName,
          reason: "Member left",
        },
      },
      actorId || userId,
    );

    return { success: true };
  } catch (error) {
    console.error("Remove member error:", error);

    return {
      success: false,
      error: getGroupServiceErrorMessage(
        error,
        "Failed to remove member from group",
      ),
    };
  }
};
