import React, { useEffect, useState } from "react";
import axios, { AxiosError } from "axios";
import styles from "./Dashboard.module.css";
type MeetingType = "PUBLIC" | "PRIVATE" | "FRIENDS";

interface Meeting {
  id: string;
  title: string;
  type: MeetingType;
  ownerId: string;
  createdAt: string;
}

interface User {
  id: string;
  name?: string;
  email: string;
}

interface DashboardProps {
  apiUrl?: string;
  user: User;
  token: string;
  onJoinMeeting: (m: Meeting) => void;
}

const Dashboard: React.FC<DashboardProps> = ({
  apiUrl = process.env.REACT_APP_API_URL || "http://localhost:3001",
  user,
  token,
  onJoinMeeting,
}) => {
  const [myActiveMeetings, setMyActiveMeetings] = useState<Meeting[]>([]);
  const [publicMeetings, setPublicMeetings] = useState<Meeting[]>([]);
  const [friendMeetings, setFriendMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [type, setType] = useState<MeetingType>("PUBLIC");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const authHeaders = () => ({ Authorization: `Bearer ${token}` });

  async function fetchAll() {
    setLoading(true);
    setErrorMsg(null);
    try {
      const [mineRes, pubRes, friendsRes] = await Promise.all([
        axios.get<Meeting[]>(`${apiUrl}/meetings/user/${user.id}`, {
          headers: authHeaders(),
        }),
        axios.get<Meeting[]>(`${apiUrl}/meetings/all`, {
          headers: authHeaders(),
        }),
        axios.get<Meeting[]>(`${apiUrl}/meetings/friends/${user.id}`, {
          headers: authHeaders(),
        }),
      ]);
      setMyActiveMeetings(mineRes.data);
      setPublicMeetings(pubRes.data);
      setFriendMeetings(friendsRes.data);
    } catch (err) {
      handleAxiosError(err, "Error cargando reuniones");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchAll();
    // Las notificaciones en tiempo real llegan por socket.io (ver App.tsx)
    // Si quieres refrescar reuniones en tiempo real, puedes escuchar eventos aquí usando socket.io
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createMeeting(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setCreating(true);
    setErrorMsg(null);
    try {
      const { data } = await axios.post<Meeting>(
        `${apiUrl}/meetings/create`,
        { title, type },
        { headers: authHeaders() }
      );
      setTitle("");
      setType("PUBLIC");
      await fetchAll();
      onJoinMeeting(data);
    } catch (err) {
      handleAxiosError(err, "Error creando la reunión");
    } finally {
      setCreating(false);
    }
  }

  async function joinMeeting(m: Meeting) {
    try {
      await axios.post(
        `${apiUrl}/meetings/join`,
        { meetingId: m.id, userId: user.id }, // ← IMPORTANTE
        { headers: authHeaders() }
      );
      onJoinMeeting(m);
    } catch (err) {
      handleAxiosError(err, "No se pudo entrar a la reunión");
    }
  }

  async function deleteMeeting(m: Meeting) {
    if (!window.confirm(`¿Eliminar la reunión "${m.title}"?`)) return;
    try {
      await axios.delete(`${apiUrl}/meetings/${m.id}`, {
        headers: authHeaders(),
      });
      await fetchAll();
    } catch (err) {
      handleAxiosError(err, "No se pudo eliminar la reunión");
    }
  }

  function handleAxiosError(error: unknown, fallback: string) {
    const err = error as AxiosError<any>;
    console.error(err);
    let msg = fallback;
    if (err.response?.data) {
      msg =
        typeof err.response.data === "string"
          ? err.response.data
          : JSON.stringify(err.response.data);
    } else if (err.message) {
      msg = err.message;
    }
    setErrorMsg(msg);
  }

  return (
    <div className={styles.dashboardRoot}>
      <h2 className={styles.dashboardGreeting}>
        Hola {user.name || user.email} 👋
      </h2>

      {/* Crear reunión */}
      <div className={styles.dashboardSectionWrapper}>
        <h3 className={styles.dashboardSectionTitle}>Crear nueva reunión</h3>
        <form onSubmit={createMeeting} className={styles.dashboardForm}>
          <input
            className={styles.dashboardInput}
            placeholder="Título"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={creating}
          />
          <select
            className={styles.dashboardInput}
            value={type}
            onChange={(e) => setType(e.target.value as MeetingType)}
            disabled={creating}
          >
            <option value="PUBLIC">Pública</option>
            <option value="FRIENDS">Amigos</option>
            <option value="PRIVATE">Privada</option>
          </select>
          <button
            className={styles.dashboardCreateBtn}
            disabled={creating}
            type="submit"
          >
            {creating ? "Creando..." : "Crear"}
          </button>
        </form>
        {errorMsg && (
          <div
            style={{
              background: "#ff4d4f22",
              color: "#ff4d4f",
              padding: "12px",
              borderRadius: "8px",
              marginTop: "8px",
            }}
          >
            <strong>Error:</strong> {errorMsg}
          </div>
        )}
      </div>

      {loading ? (
        <div className={styles.loadingSpinner} />
      ) : (
        <>
          <Section
            title="Tus reuniones activas"
            meetings={myActiveMeetings}
            currentUserId={user.id}
            onJoin={joinMeeting}
            onDelete={deleteMeeting}
          />

          <Section
            title="Reuniones públicas"
            meetings={publicMeetings}
            currentUserId={user.id}
            onJoin={joinMeeting}
          />

          <Section
            title="Reuniones de amigos"
            meetings={friendMeetings}
            currentUserId={user.id}
            onJoin={joinMeeting}
          />
        </>
      )}
    </div>
  );
};

export default Dashboard;

/* --------------------- Subcomponentes --------------------- */

interface SectionProps {
  title: string;
  meetings: Meeting[];
  currentUserId: string;
  onJoin: (m: Meeting) => void;
  onDelete?: (m: Meeting) => void;
}

const Section: React.FC<SectionProps> = ({
  title,
  meetings,
  currentUserId,
  onJoin,
  onDelete,
}) => {
  return (
    <div className={styles.dashboardSectionWrapper}>
      <h3 className={styles.dashboardSectionTitle}>{title}</h3>
      {meetings.length === 0 ? (
        <p className={styles.dashboardSectionSubtitle}>Sin reuniones aquí.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {meetings.map((m) => (
            <li key={m.id} className={styles.meetingItem}>
              <div>
                <strong>{m.title}</strong>
                <span
                  className={`${styles.meetingLabel} ${
                    m.type === "PUBLIC"
                      ? styles.public
                      : m.type === "PRIVATE"
                      ? styles.private
                      : styles.friend
                  }`}
                >
                  {m.type.toLowerCase()}
                </span>
                <br />
                <small>ID: {m.id}</small>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  className={styles.dashboardMeetingBtn}
                  onClick={() => onJoin(m)}
                >
                  Unirme
                </button>
                {onDelete && m.ownerId === currentUserId && (
                  <button
                    className={styles.dashboardMeetingBtn}
                    style={{ background: "#ef4444" }}
                    onClick={() => onDelete(m)}
                  >
                    Eliminar
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
