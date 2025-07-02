import React, { useEffect, useState } from "react";
import styles from "./Dashboard.module.css";
import {
  Typography,
  TextField,
  Button,
  Paper,
  Avatar,
  Fade,
} from "@mui/material";
import { motion } from "framer-motion";

type User = { id: string; name: string; email: string };
type Meeting = { id: string; title: string; type: string };

type Props = {
  user: User;
  token: string;
  onJoinMeeting: (meeting: Meeting) => void;
  refreshKey?: number;
};

const API = process.env.REACT_APP_API_URL;

export default function Dashboard({
  user,
  token,
  onJoinMeeting,
  refreshKey,
}: Props) {
  const [friends, setFriends] = useState<User[]>([]);
  const [friendsMeetings, setFriendsMeetings] = useState<
    Record<string, Meeting[]>
  >({});
  const [myMeetings, setMyMeetings] = useState<Meeting[]>([]);
  const [newMeetingTitle, setNewMeetingTitle] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const resSelf = await fetch(
          `${API}/meetings/user/${user.id}/meetings/active`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        const myMeetingsData = await resSelf.json();
        setMyMeetings(Array.isArray(myMeetingsData) ? myMeetingsData : []);

        const resFriends = await fetch(`${API}/meetings/friend/list`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const friendsArr = await resFriends.json();
        setFriends(Array.isArray(friendsArr) ? friendsArr : []);

        const meetingsMap: Record<string, Meeting[]> = {};
        await Promise.all(
          friendsArr.map(async (friend: User) => {
            const res2 = await fetch(
              `${API}/meetings/user/${friend.id}/meetings/active`,
              {
                headers: { Authorization: `Bearer ${token}` },
              }
            );
            const friendMeetingsData = await res2.json();
            meetingsMap[friend.id] = Array.isArray(friendMeetingsData)
              ? friendMeetingsData
              : [];
          })
        );
        setFriendsMeetings(meetingsMap);
      } catch (error) {
        console.error("Error fetching data:", error);
        setMyMeetings([]);
        setFriends([]);
        setFriendsMeetings({});
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [token, user.id, refreshKey]);

  async function handleCreateMeeting(e: React.FormEvent) {
    e.preventDefault();
    if (!newMeetingTitle.trim()) return;
    try {
      const res = await fetch(`${API}/meetings/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ title: newMeetingTitle, type: "public" }),
      });
      const newMeeting = await res.json();
      setMyMeetings((prev) =>
        Array.isArray(prev) ? [...prev, newMeeting] : [newMeeting]
      );
      setNewMeetingTitle("");
    } catch (error) {
      console.error("Error creating meeting:", error);
    }
  }

  return (
    <motion.div
      className={styles.dashboardRoot}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <h1 className={styles.dashboardGreeting}>
        👋{" "}
        <span>
          Hello, <strong>{user.name || user.email}</strong>
        </span>
      </h1>
      {loading && <div className={styles.loadingSpinner}></div>}

      {!loading && (
        <div className={styles.dashboardGrid}>
          {/* Your Meetings */}
          <Paper elevation={6} className={styles.dashboardCard}>
            <div className={styles.dashboardSectionWrapper}>
              <div className={styles.dashboardCard}>... Your Meetings ...</div>
            </div>
            <form
              onSubmit={handleCreateMeeting}
              className={styles.dashboardForm}
            >
              <TextField
                fullWidth
                variant="outlined"
                placeholder="Meeting title"
                value={newMeetingTitle}
                onChange={(e) => setNewMeetingTitle(e.target.value)}
                className={styles.dashboardInput}
              />
              <Button
                type="submit"
                className={styles.dashboardCreateBtn}
                variant="contained"
              >
                Create
              </Button>
            </form>
            <ul>
              {myMeetings.map((meeting) => (
                <li key={meeting.id} className={styles.meetingItem}>
                  <span>{meeting.title}</span>
                  <Button
                    size="small"
                    className={styles.dashboardMeetingBtn}
                    onClick={() => onJoinMeeting(meeting)}
                    variant="outlined"
                  >
                    Join
                  </Button>
                </li>
              ))}
            </ul>
          </Paper>

          {/* Friends' Meetings */}
          <Paper elevation={6} className={styles.dashboardCard}>
            <div className={styles.dashboardSectionWrapper}>
              <div className={styles.dashboardCard}>
                ... Friends & Their Meetings ...
              </div>
            </div>
            <ul>
              {friends.map((friend) => (
                <li key={friend.id} className={styles.friendItem}>
                  <div className={styles.friendHeader}>
                    <div className={styles.friendAvatar}>
                      {(friend.name || friend.email)[0].toUpperCase()}
                    </div>
                    <span className={styles.friendName}>
                      {friend.name || friend.email}
                    </span>
                  </div>

                  <div className={styles.friendMeetingList}>
                    {friendsMeetings[friend.id]?.length > 0 ? (
                      friendsMeetings[friend.id].map((mtg) => (
                        <div key={mtg.id} className={styles.friendMeetingItem}>
                          <span>{mtg.title}</span>
                          <button
                            className={styles.dashboardMeetingBtn}
                            onClick={() => onJoinMeeting(mtg)}
                          >
                            Join
                          </button>
                        </div>
                      ))
                    ) : (
                      <div className={styles.friendMeetingItem}>
                        No active meetings
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </Paper>
        </div>
      )}
    </motion.div>
  );
}
