import "./CardFallLoader.css";

function OutlineCard() {
  return (
    <svg
      className="card-fall-svg"
      viewBox="0 0 200 280"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <rect
        className="card-fall-outline"
        x="18"
        y="14"
        width="164"
        height="252"
        rx="16"
        fill="none"
        strokeWidth="3.5"
      />
      <svg
        className="card-fall-mark"
        id="Layer_1"
        xmlns="http://www.w3.org/2000/svg"
        version="1.1"
        viewBox="0 0 20 20"
        x="0"
        y="40"
        width="200"
        height="200"
      >
        <path d="M6.6,6.2c0,.1,0,.5,0,.9.2.4.5.6.6.7-.2,0-.4.3-.6.5,0,.1-.2.4-.4.5s0,0,0,0c0-.1-.6-.8-.4-1.6,0-.3.2-.5.3-.7.1-.1.3-.2.4-.4ZM13.3,10.2c0,.4-.2.7-.5,1h0l-2.5,2.5c-.1.1-.3.1-.4,0h0l-2.5-2.5c-.8-.8-.8-2,0-2.8s.7-.5,1.1-.6c.6,0,1.2,0,1.7.5h0c.4-.4,1-.6,1.6-.5h0c1.1.2,1.8,1.2,1.6,2.3h-.1ZM13.5,8.9h0c-.1-.1-.2-.3-.4-.5s-.4-.4-.6-.5c.3-.2.5-.4.6-.7.1-.3.1-.6.1-.9h0l.2.2q.1.1,0,0c-.2-.2,0,0,0,0h0c.2.3.8,1.3,0,2.4h0Z" />
        <path d="M6.7,8.7h0Z" />
        <path d="M10,6.4" />
      </svg>
    </svg>
  );
}

export function CardFallLoader({
  label = "Loading",
}: {
  label?: string;
}) {
  return (
    <div className="card-fall-loader" role="status" aria-label={label}>
      <div className="card-fall-layer card-fall-layer--a">
        <OutlineCard />
      </div>
      <div className="card-fall-layer card-fall-layer--b">
        <OutlineCard />
      </div>
      <div className="card-fall-layer card-fall-layer--c">
        <OutlineCard />
      </div>
      <span className="sr-only">{label}</span>
    </div>
  );
}
