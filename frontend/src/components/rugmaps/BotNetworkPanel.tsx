import { useState } from 'react';
import { motion } from 'framer-motion';
import { Bot, Zap, Users, Activity, AlertTriangle, ShieldCheck, Loader2 } from 'lucide-react';

interface BotSuite {
  name: string;
  confidence: number;
  wallets: number;
  volumeFake: number;
  pattern: string;
}

interface BotNetworkPanelProps {
  tokenAddress: string;
  chain: string;
}

const KNOWN_BOTS = [
  { name: 'Axiom', pattern: 'jito_bundle', signature: 'high_gas_first_block' },
  { name: 'Bloom', pattern: 'bloXroute', signature: 'coordinated_entry' },
  { name: 'Photon', pattern: 'mev_bundle', signature: 'sandwich_pattern' },
  { name: 'GMGN', pattern: 'aggregator', signature: 'multi_dex_split' },
  { name: 'Trojan', pattern: 'copycat', signature: 'identical_tx_structure' },
  { name: 'Padre', pattern: 'volume_bot', signature: 'wash_cycle_3s' },
];

export default function BotNetworkPanel({ tokenAddress, chain }: BotNetworkPanelProps) {
  const [bots, setBots] = useState<BotSuite[]>([]);
  const [loading, setLoading] = useState(false);
  const [analyzed, setAnalyzed] = useState(false);

  const detectBots = () => {
    setLoading(true);
    // Simulate detection — replace with real stealthDetection.ts integration
    setTimeout(() => {
      const detected: BotSuite[] = [];
      const numBots = Math.floor(Math.random() * 3) + 1;
      for (let i = 0; i < numBots; i++) {
        const bot = KNOWN_BOTS[Math.floor(Math.random() * KNOWN_BOTS.length)];
        detected.push({
          name: bot.name,
          confidence: Math.floor(Math.random() * 30) + 70,
          wallets: Math.floor(Math.random() * 15) + 3,
          volumeFake: Math.random() * 80 + 10,
          pattern: bot.pattern,
        });
      }
      setBots(detected);
      setLoading(false);
      setAnalyzed(true);
    }, 2000);
  };

  if (!analyzed) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card rounded-[16px] p-5"
      >
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-8 h-8 rounded-[9px] bg-[#8B5CF6]/10 flex items-center justify-center">
            <Bot className="w-[15px] h-[15px] text-[#8B5CF6]" />
          </div>
          <div>
            <h3 className="text-[14px] font-semibold text-[#F1F1F6]">Bot Network Detection</h3>
          </div>
        </div>
        <button
          onClick={detectBots}
          disabled={loading}
          className="btn btn-primary w-full"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Bot className="w-4 h-4 mr-2" />}
          {loading ? 'Analyzing transaction patterns...' : 'Detect Bot Networks'}
        </button>
      </motion.div>
    );
  }

  if (bots.length === 0) {
    return (
      <div className="glass-card rounded-[16px] p-5">
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck className="w-5 h-5 text-emerald-400" />
          <span className="text-[13px] font-semibold text-emerald-400">No Bot Networks Detected</span>
        </div>
        <p className="text-[11px] text-[#9DA0B0]">Transaction patterns appear organic. No known bot suite signatures found.</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card rounded-[16px] p-5"
    >
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-8 h-8 rounded-[9px] bg-[#8B5CF6]/10 flex items-center justify-center">
          <Bot className="w-[15px] h-[15px] text-[#8B5CF6]" />
        </div>
        <div>
          <h3 className="text-[14px] font-semibold text-[#F1F1F6]">Bot Networks</h3>
        </div>
        <span className="badge badge-danger text-[9.5px] ml-auto">{bots.length} detected</span>
      </div>

      <div className="space-y-3">
        {bots.map((bot, i) => (
          <div key={i} className="p-3 rounded-[10px] bg-[#8B5CF6]/5 border border-[#8B5CF6]/20">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-[#8B5CF6]" />
                <span className="text-[13px] font-semibold text-[#F1F1F6]">{bot.name}</span>
              </div>
              <span className="text-[10px] text-[#8B5CF6] font-mono">{bot.confidence}% match</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-[11px]">
              <div className="text-[#9DA0B0]">
                <Users className="w-3 h-3 inline mr-1" />
                {bot.wallets} wallets
              </div>
              <div className="text-[#9DA0B0]">
                <Activity className="w-3 h-3 inline mr-1" />
                {bot.volumeFake.toFixed(0)}% fake vol
              </div>
              <div className="text-[#9DA0B0]">
                <Bot className="w-3 h-3 inline mr-1" />
                {bot.pattern}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 p-2.5 rounded-[8px] bg-[#FF3366]/5 border border-[#FF3366]/10">
        <div className="flex items-center gap-2 text-[11px]">
          <AlertTriangle className="w-4 h-4 text-[#FF3366]" />
          <span className="text-[#FF3366]">Estimated fake volume: {bots.reduce((acc, b) => acc + b.volumeFake, 0).toFixed(0)}% of total</span>
        </div>
      </div>
    </motion.div>
  );
}
