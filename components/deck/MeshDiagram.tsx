import { Radio, WifiOff } from 'lucide-react'
import styles from './mesh-diagram.module.css'

const links = [
  { path: 'M 208 255 C 315 255 335 125 432 125', delay: '0s' },
  { path: 'M 208 255 C 315 255 335 385 432 385', delay: '0.6s' },
  { path: 'M 548 125 C 650 125 675 255 792 255', delay: '1.2s' },
  { path: 'M 548 385 C 650 385 675 255 792 255', delay: '1.8s' },
]

function Phone({ x, y, fill, title, state, label, origin = false }: {
  x: number; y: number; fill: string; title: string; state: string; label: string; origin?: boolean
}) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle r="110" fill={fill} fillOpacity="0.2" stroke="currentColor" strokeOpacity="0.12" />
      <circle r="94" fill="none" stroke="currentColor" strokeOpacity="0.15" strokeDasharray="3 9" />
      <rect x="-53" y="-84" width="116" height="180" rx="23" fill="currentColor" opacity="0.15" />
      <rect x="-58" y="-90" width="116" height="180" rx="23" fill="#17140f" />
      <rect x="-51" y="-83" width="102" height="166" rx="17" fill={fill} />
      <rect x="-22" y="-79" width="44" height="9" rx="5" fill="#17140f" />
      <text y="-49" textAnchor="middle" fontSize="10" fontWeight="700" letterSpacing="1.4">CIVICPULSE</text>
      <circle cy="-7" r="29" fill="#f5f0e1" stroke="#17140f" strokeWidth="1.5" />
      {origin ? <text y="0" textAnchor="middle" fontSize="21" fontWeight="800">SOS</text> : <Radio x="-18" y="-25" width="36" height="36" strokeWidth="1.8" />}
      <text y="41" textAnchor="middle" fontSize="13" fontWeight="700">{title}</text>
      <text y="59" textAnchor="middle" fontSize="10">{state}</text>
      <rect x="-19" y="73" width="38" height="3" rx="2" fill="#17140f" opacity="0.5" />
      <text y="121" textAnchor="middle" fontSize="19" fontWeight="700">{label}</text>
    </g>
  )
}

export function MeshDiagram() {
  return (
    <div className="relative h-[530px] min-w-0 flex-1">
      <div className="absolute left-5 top-2 flex items-center gap-2 font-mono text-sm font-bold uppercase tracking-widest text-ink/65">
        <WifiOff size={20} /> Internet offline <span className="mx-2 text-ink/25">/</span><span className="text-ink">Mesh online</span>
      </div>
      <svg viewBox="0 0 1040 530" className="h-full w-full text-ink" role="img" aria-labelledby="mesh-title mesh-description">
        <title id="mesh-title">An SOS travels phone to phone through a neighbourhood mesh</title>
        <desc id="mesh-description">An offline sender passes an SOS to two nearby relay phones. Both forward it toward a neighbour, where duplicate alerts are filtered. Animated dots illustrate packets, not live network activity.</desc>
        <defs>
          <pattern id="mesh-grid" width="24" height="24" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1" fill="#17140f" opacity="0.12" />
          </pattern>
          <marker id="mesh-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 1 1 L 8 5 L 1 9" fill="none" stroke="#17140f" strokeWidth="1.5" />
          </marker>
        </defs>
        <rect x="10" y="50" width="1000" height="450" fill="url(#mesh-grid)" />
        <path d="M 490 215 L 490 295" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" strokeDasharray="6 7" />
        {links.map(({ path, delay }) => (
          <g key={path}>
            <path d={path} fill="none" stroke="#f5f0e1" strokeWidth="12" />
            <path d={path} fill="none" stroke="currentColor" strokeWidth="2.5" markerEnd="url(#mesh-arrow)" />
            <circle r="7" fill="#f2b5d9" stroke="#17140f" strokeWidth="2" className={styles.packet}>
              <animateMotion dur="3s" begin={delay} repeatCount="indefinite" path={path} />
            </circle>
          </g>
        ))}
        <Phone x={150} y={255} fill="#f2b5d9" title="Send SOS" state="Saved on device" label="01 / Sender" origin />
        <Phone x={490} y={125} fill="#f3d35b" title="Store + relay" state="Nearby peer found" label="02 / Relay A" />
        <Phone x={490} y={385} fill="#b4c3ec" title="Store + relay" state="Another path" label="02 / Relay B" />
        <Phone x={850} y={255} fill="#f5f0e1" title="SOS received" state="Community · unverified" label="03 / Neighbour" />
        <g transform="translate(283 235)">
          <rect width="119" height="32" rx="16" fill="#17140f" />
          <text x="59.5" y="21" textAnchor="middle" fill="#f5f0e1" fontSize="13" fontWeight="700">Nearby link</text>
        </g>
        <g transform="translate(632 359)">
          <rect width="123" height="32" rx="16" fill="#f5f0e1" stroke="#17140f" />
          <text x="61.5" y="21" textAnchor="middle" fontSize="13" fontWeight="700">Same alert ID</text>
        </g>
      </svg>
    </div>
  )
}