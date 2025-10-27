import { listRecentRuns, listUploads, nextScheduledTime } from "@/lib/db";
import { UploadRecord } from "@/lib/types";

function statusPill(status: UploadRecord["status"]) {
  const map: Record<UploadRecord["status"], { label: string; color: string }> = {
    pending: { label: "Pending", color: "warning" },
    scheduled: { label: "Scheduled", color: "warning" },
    uploading: { label: "Uploading", color: "warning" },
    uploaded: { label: "Uploaded", color: "success" },
    failed: { label: "Failed", color: "danger" }
  };
  const { label, color } = map[status];
  return (
    <span className={`pill`} style={{ background: `var(--${color})`, color: "#0b0d16" }}>
      {label}
    </span>
  );
}

export default async function DashboardPage() {
  const [uploads, runs, upcoming] = await Promise.all([listUploads(), listRecentRuns(), nextScheduledTime()]);
  const pending = uploads.filter((upload) => upload.status === "pending" || upload.status === "scheduled");
  const completed = uploads.filter((upload) => upload.status === "uploaded");
  const failed = uploads.filter((upload) => upload.status === "failed");

  return (
    <div className="grid">
      <section className="grid two">
        <div className="card">
          <h2>Pipeline Status</h2>
          <p style={{ color: "rgba(255,255,255,0.6)" }}>
            {pending.length} scheduled · {completed.length} published · {failed.length} needs attention
          </p>
          <div style={{ marginTop: 24, display: "grid", gap: 12 }}>
            <Stat label="Next Slot" value={upcoming ? upcoming.toLocaleString() : "N/A"} />
            <Stat label="Total Uploaded" value={completed.length.toString()} />
            <Stat label="Queue" value={pending.length.toString()} />
          </div>
        </div>

        <div className="card">
          <h2>Recent Agent Runs</h2>
          <table>
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Discovered</th>
                <th>Uploaded</th>
                <th>Failed</th>
              </tr>
            </thead>
            <tbody>
              {runs.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ padding: "20px 0", color: "rgba(255,255,255,0.5)" }}>
                    No runs logged yet.
                  </td>
                </tr>
              ) : (
                runs.map((run) => (
                  <tr key={run.timestamp}>
                    <td>{new Date(run.timestamp).toLocaleString()}</td>
                    <td>{run.discovered}</td>
                    <td>{run.uploaded}</td>
                    <td>{run.failed}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <h2>Upload Queue</h2>
        <table>
          <thead>
            <tr>
              <th>Title</th>
              <th>Scheduled</th>
              <th>Status</th>
              <th>Attempts</th>
            </tr>
          </thead>
          <tbody>
            {uploads.map((upload) => (
              <tr key={upload.id}>
                <td>{upload.metadata.title}</td>
                <td>{new Date(upload.scheduledAt).toLocaleString()}</td>
                <td>{statusPill(upload.status)}</td>
                <td>{upload.attempts}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card">
        <h2>Latest Uploads</h2>
        <table>
          <thead>
            <tr>
              <th>Title</th>
              <th>Published</th>
              <th>Video ID</th>
            </tr>
          </thead>
          <tbody>
            {completed.slice(0, 10).map((upload) => (
              <tr key={upload.id}>
                <td>{upload.metadata.title}</td>
                <td>{upload.publishedAt ? new Date(upload.publishedAt).toLocaleString() : "-"}</td>
                <td>
                  {upload.youtubeId ? (
                    <a href={`https://www.youtube.com/watch?v=${upload.youtubeId}`} target="_blank" rel="noreferrer">
                      {upload.youtubeId}
                    </a>
                  ) : (
                    "-"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, letterSpacing: "0.08em" }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 600 }}>{value}</div>
    </div>
  );
}
