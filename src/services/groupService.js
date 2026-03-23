import {
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";

import { db } from "../config/firebaseConfig";
import { enforceCooldown } from "../utils/rateLimit";

const CREATE_GROUP_COOLDOWN_MS = 3 * 1000;

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

/*
|--------------------------------------------------------------------------
| createGroup(name, emoji, memberIds, createdBy)
|--------------------------------------------------------------------------
| Creates a new group document in Firestore.
|
| Structure:
| groups/{groupId}
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
| safer Firestore rules.
*/
export const createGroup = async (name, emoji, memberIds, createdBy) => {
  try {
    const uniqueMemberIds = [...new Set([...(memberIds || []), createdBy].filter(Boolean))];
    if (uniqueMemberIds.length === 0 || uniqueMemberIds.length > 25) {
      throw new Error("Groups must have between 1 and 25 members.");
    }

    sanitizeGroupName(name);

    const cooldown = enforceCooldown(`create-group:${createdBy}`, CREATE_GROUP_COOLDOWN_MS);
    if (!cooldown.allowed) {
      throw new Error("Please wait a moment before creating another group.");
    }

    const groupRef = doc(collection(db, "groups"));
    const groupId = groupRef.id;

    const groupData = {
      id: groupId,
      name: sanitizeGroupName(name),
      emoji: String(emoji || "👥").slice(0, 2),
      members: uniqueMemberIds,
      createdBy,
      createdAt: serverTimestamp(),
      lastActivity: serverTimestamp(),
    };

    await setDoc(groupRef, groupData);

    return {
      success: true,
      groupId,
    };
  } catch (error) {
    console.error("Create group error:", error);

    return {
      success: false,
      error: error.message || "Failed to create group",
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
    const groupRef = doc(db, "groups", groupId);
    const snapshot = await getDoc(groupRef);

    if (!snapshot.exists()) {
      return {
        success: false,
        error: "Group not found",
      };
    }

    return {
      success: true,
      group: snapshot.data(),
    };
  } catch (error) {
    console.error("Get group error:", error);

    return {
      success: false,
      error: error.message || "Failed to fetch group",
    };
  }
};

/*
|--------------------------------------------------------------------------
| getUserGroups(userId, onUpdate)
|--------------------------------------------------------------------------
| Real-time listener for groups where the user is a member.
|
| Firestore query:
| groups where members array contains userId
|
| onUpdate(groups) will be called whenever group data changes.
|
| Returns unsubscribe function to stop listening.
*/
export const getUserGroups = (userId, onUpdate) => {
  try {
    const groupsRef = collection(db, "groups");

    const q = query(groupsRef, where("members", "array-contains", userId));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const groups = [];

      snapshot.forEach((doc) => {
        groups.push(doc.data());
      });

      onUpdate(groups);
    });

    return unsubscribe;
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
| Uses Firestore arrayUnion to prevent duplicates.
*/
export const addMemberToGroup = async (groupId, userId) => {
  try {
    if (!groupId || !userId) {
      throw new Error("Group ID and user ID are required.");
    }

    const groupRef = doc(db, "groups", groupId);

    await updateDoc(groupRef, {
      members: arrayUnion(userId),
      lastActivity: serverTimestamp(),
    });

    return { success: true };
  } catch (error) {
    console.error("Add member error:", error);

    return {
      success: false,
      error: error.message || "Failed to add member to group",
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
    const groupRef = doc(db, "groups", groupId);

    await updateDoc(groupRef, {
      lastActivity: serverTimestamp(),
    });

    return { success: true };
  } catch (error) {
    console.error("Update activity error:", error);

    return {
      success: false,
      error: error.message || "Failed to update group activity",
    };
  }
};

export const removeMemberFromGroup = async (groupId, userId) => {
  try {
    if (!groupId || !userId) {
      throw new Error("Group ID and user ID are required.");
    }

    const groupRef = doc(db, "groups", groupId);

    await updateDoc(groupRef, {
      members: arrayRemove(userId),
      lastActivity: serverTimestamp(),
    });

    return { success: true };
  } catch (error) {
    console.error("Remove member error:", error);

    return {
      success: false,
      error: error.message || "Failed to remove member from group",
    };
  }
};
