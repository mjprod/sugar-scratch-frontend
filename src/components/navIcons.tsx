export function GuestCollectionIcon({
  className,
}: {
  className?: string;
  strokeWidth?: number;
  fill?: string;
  fillOpacity?: number;
}) {
  return (
    <svg
      viewBox="4.8 5.6 10.3 9.4"
      className={className}
      aria-hidden="true"
    >
      <path
        fill="currentColor"
        d="M5.8 6.1s.4.7 1.2.9c-.7.3-1.1 1-1.2 1.7-.4-.3-.7-1 0-2.6Z"
      />
      <path
        fill="currentColor"
        d="M10.5 13.5l-.5.5-.5-.5c-1.9-1.7-3.1-2.8-3.1-4.2s.9-2 2-2 1.2.3 1.6.8c.4-.5 1-.8 1.6-.8 1.1 0 2 .9 2 2s-1.2 2.5-3.1 4.2Z"
      />
      <path
        fill="currentColor"
        d="M14.2 8.8c0-.8-.5-1.4-1.2-1.8.4 0 .8-.4 1.3-.9 0 0 .9 1.7-.1 2.7Z"
      />
    </svg>
  );
}

export function LoginIcon({
  className,
  strokeWidth = 2,
}: {
  className?: string;
  strokeWidth?: number;
  fill?: string;
  fillOpacity?: number;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={["nav-login-icon", className].filter(Boolean).join(" ")}
      aria-hidden="true"
    >
      <path
        d="M17,12l-4,4M13,8l4,4M3,12h14M8,8v-1c0-1.7,1.3-3,3-3h7c1.7,0,3,1.3,3,3v10c0,1.7-1.3,3-3,3h-7c-1.7,0-3-1.3-3-3v-1"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Shop tab — tilted card with plus. */
export function ShopIcon({
  className,
  strokeWidth = 1.5,
}: {
  className?: string;
  strokeWidth?: number;
  fill?: string;
  fillOpacity?: number;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      overflow="visible"
      className={className}
      aria-hidden="true"
    >
      <path
        d="m18.942 15.05l.626 2.44a2 2 0 0 1-1.44 2.434L7.433 22.67a2 2 0 0 1-2.435-1.44L1.22 6.51a2 2 0 0 1 1.44-2.434L13.354 1.33a2 2 0 0 1 2.215.912"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Plus scaled 1.5×; shifted up-right so the inner gap stays clear. */}
      <path
        d="M20.893 11.352V-.363M15.035 5.495h11.715"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Rank tab — crown from /images/home-v2/rank-crown-silver.svg */
export function RankIcon({
  className,
  strokeWidth = 1.5,
  fill = "none",
  fillOpacity = 0,
}: {
  className?: string;
  strokeWidth?: number;
  fill?: string;
  fillOpacity?: number;
}) {
  // Tight 17.4 viewBox makes a 24-unit stroke look heavier; keep thinner than Shop.
  const sw = Math.max(0.55, (strokeWidth * 12) / 24);
  return (
    <svg
      viewBox="1.8 3.6 17.4 15.2"
      fill="none"
      overflow="visible"
      className={["nav-rank-icon", className].filter(Boolean).join(" ")}
      aria-hidden="true"
    >
      <path
        d="M10.127 4.201c.037-.061.091-.112.156-.147A.5.5 0 0 1 10.5 4c.076 0 .15.019.216.054c.065.035.119.086.156.147l2.51 4.36c.06.101.143.189.244.257c.102.068.218.115.341.136c.123.022.25.019.372-.01c.122-.028.235-.081.331-.154l3.637-2.851c.07-.052.155-.082.245-.087c.09-.004.179.018.254.063c.076.045.134.11.166.187c.032.077.037.161.013.241l-2.41 7.972c-.049.163-.155.307-.301.41c-.147.103-.326.16-.511.161H5.237c-.185-.001-.365-.058-.511-.161c-.147-.103-.253-.247-.303-.41L2.015 6.344a.5.5 0 0 1 .013-.241a.5.5 0 0 1 .165-.187a.5.5 0 0 1 .255-.062c.09.004.175.034.245.086L6.329 8.791c.096.073.21.126.331.154c.122.028.249.032.372.01c.123-.022.24-.068.341-.136c.101-.068.185-.156.245-.257z"
        fill={fill}
        fillOpacity={fillOpacity}
        stroke="currentColor"
        strokeWidth={sw}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4.548 18h11.903"
        stroke="currentColor"
        strokeWidth={sw}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Store tab — sourced from /public/svg/iconDiamond.svg */
export function DiamondIcon({
  className,
}: {
  className?: string;
  strokeWidth?: number;
  fill?: string;
  fillOpacity?: number;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={["nav-diamond-icon", className].filter(Boolean).join(" ")}
      aria-hidden="true"
    >
      <path
        fill="currentColor"
        d="M11.329 19.159q-.323-.14-.566-.432L3.267 9.731q-.186-.217-.28-.475t-.093-.55q0-.187.047-.366q.048-.18.134-.361l1.779-3.59q.217-.405.603-.647t.845-.242h11.396q.46 0 .845.242t.603.646l1.779 3.59q.087.182.134.362t.047.366q0 .292-.094.55t-.28.475l-7.495 8.996q-.243.292-.566.432q-.323.139-.671.139t-.671-.14M8.817 8.5h6.366l-2-4h-2.366zm2.683 9.56V9.5H4.392zm1 0l7.108-8.56H12.5zm3.792-9.56h3.766L18.23 4.846q-.077-.154-.231-.25t-.327-.096h-3.38zm-12.35 0h3.766l2-4H6.327q-.173 0-.327.096t-.23.25z"
      />
    </svg>
  );
}

/** My Collection tab — stacked cards mark (14 artboard, padded for stroke). */
export function CollectionIcon({
  className,
  strokeWidth = 1.8,
}: {
  className?: string;
  strokeWidth?: number;
  fill?: string;
  fillOpacity?: number;
}) {
  // Lucide icons use ~1.8–2.1 on a 24 viewBox; scale to this 14 artboard.
  const sw = Math.max(0.9, (strokeWidth * 14) / 24);
  return (
    <svg
      viewBox="-1 -1 16 16"
      fill="none"
      overflow="visible"
      className={["nav-collect-icon", className].filter(Boolean).join(" ")}
      aria-hidden="true"
    >
      <g
        stroke="currentColor"
        strokeWidth={sw}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M6.546.857a.475.475 0 0 1 .581-.335l6.02 1.612a.475.475 0 0 1 .337.581l-2.31 8.618a.475.475 0 0 1-.582.335l-6.02-1.612a.475.475 0 0 1-.336-.581z" />
        <path d="M6.108 2.535L.852 3.944a.475.475 0 0 0-.336.581l2.308 8.618a.475.475 0 0 0 .582.335l3.01-.806" />
      </g>
    </svg>
  );
}
