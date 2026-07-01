import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, AlertTriangle, ShieldCheck, ExternalLink, Zap, Loader2, Crosshair, Globe, GitBranch } from 'lucide-react';
import { searchRAG, getDeployerRisk, getCrossChainIdentity, type RAGSearchResult, type DeployerRisk } from '@/services/rugmapsRagBridge';

interface RAGIntelligencePanelProps {
  tokenAddress: string;
  chain: string;
  deployerAddress?: string;
}

export default function RAGIntelligencePanel({ tokenAddress, chain, deployerAddress }: RAGIntelligencePanelProps) {
  const [ragResults, setRagResults] = useState<RAGSearchResult[]>([]);
  const [deployerRisk, setDeployerRisk] = useState<DeployerRisk | null>(null);
  const [crossChain, setCrossChain] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!tokenAddress) return;
    
    setLoading(true);
    Promise.allSettled([
      searchRAG(`token ${tokenAddress} rug pull scam honeypot`, tokenAddress, chain, 5),
      deployerAddress ? getDeployerRisk(deployerAddress, chain) : Promise.resolve(null),
      deployerAddress ? getCrossChainIdentity(deployerAddress, chain) : Promise.resolve(null),
    ]).then(([ragRes, deployerRes, crossRes]) => {
      if (ragRes.status === 'fulfilled') setRagResults(ragRes.value);
      if (deployerRes.status === 'fulfilled') setDeployerRisk(deployerRes.value);
      if (crossRes.status === 'fulfilled') setCrossChain(crossRes.value);
      setLoading(false);
    });
  }, [tokenAddress, chain, deployerAddress]);

  if (loading) {
    return (
      <div className="glass-card rounded-[16px] p-5 flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 text-purple-400 animate-spin mr-2" />
        <span className="text-[12px] text-[#9DA0B0]">Querying RAG intelligence...</span>
      </div>
    );
  }

  const hasData = ragResults.length > 0 || deployerRisk || crossChain;
  if (!hasData) return null;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card rounded-[16px] overflow-hidden"
    >
      <div 
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-[rgba(255,255,255,0.01)] transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-[9px] bg-purple-500/10 flex items-center justify-center">
            <BookOpen className="w-[15px] h-[15px] text-purple-400" />
          </div>
          <div>
            <h3 className="text-[14px] font-semibold text-[#F1F1F6]">RAG Intelligence</h3>
            <span className="text-[10px] text-[#5C6080]">
              {ragResults.length} docs · {deployerRisk ? 'deployer scored' : ''} · {crossChain ? 'cross-chain' : ''}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {deployerRisk && (
            <span className={`badge text-[10px] ${
              deployerRisk.risk_score >= 70 ? 'badge-danger' : 
              deployerRisk.risk_score >= 40 ? 'badge-warning' : 'badge-live'
            }`}>
              Deployer {deployerRisk.risk_score}/100
            </span>
          )}
          <span className="text-[10px] text-[#5C6080]">{expanded ? '▼' : '▶'}</span>
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="p-4 pt-0 space-y-3">
              {/* Deployer Risk */}
              {deployerRisk && (
                <div className={`p-3 rounded-[10px] border ${
                  deployerRisk.risk_score >= 70 ? 'bg-[#FF3366]/5 border-[#FF3366]/20' :
                  deployerRisk.risk_score >= 40 ? 'bg-[#F59E0B]/5 border-[#F59E0B]/20' :
                  'bg-[rgba(255,255,255,0.02)] border-[rgba(255,255,255,0.04)]'
                }`}>
                  <div className="flex items-center gap-2 mb-2">
                    <Crosshair className="w-4 h-4 text-purple-400" />
                    <span className="text-[12px] font-semibold text-[#F1F1F6]">Deployer Analysis</span>
                    <span className="text-[9px] text-[#5C6080] ml-auto font-mono">{deployerAddress?.slice(0,8)}...{deployerAddress?.slice(-4)}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="text-[#9DA0B0]">Deployments: <span className="text-[#F1F1F6] font-mono">{deployerRisk.deployment_count}</span></div>
                    <div className="text-[#9DA0B0]">Previous Rugs: <span className={deployerRisk.previous_rugs > 0 ? 'text-[#FF3366]' : 'text-emerald-400'}>{deployerRisk.previous_rugs}</span></div>
                    <div className="text-[#9DA0B0]">Mixer Funded: {deployerRisk.mixer_funded ? <span className="text-[#FF3366]">Yes</span> : <span className="text-emerald-400">No</span>}</div>
                    <div className="text-[#9DA0B0]">Rapid Deploy: {deployerRisk.rapid_deploy ? <span className="text-[#FF3366]">Yes</span> : <span className="text-emerald-400">No</span>}</div>
                  </div>
                  {deployerRisk.verdict && (
                    <p className="text-[11px] text-purple-300 mt-2"><Zap className="w-3 h-3 inline mr-1"/>{deployerRisk.verdict}</p>
                  )}
                </div>
              )}

              {/* Cross-Chain Identity */}
              {crossChain?.identities?.length > 0 && (
                <div className="p-3 rounded-[10px] bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.04)]">
                  <div className="flex items-center gap-2 mb-2">
                    <Globe className="w-4 h-4 text-cyan-400" />
                    <span className="text-[12px] font-semibold text-[#F1F1F6]">Cross-Chain Deployer</span>
                  </div>
                  <div className="space-y-1">
                    {crossChain.identities.map((id: any, i: number) => (
                      <div key={i} className="flex items-center gap-2 text-[11px]">
                        <GitBranch className="w-3 h-3 text-[#5C6080]" />
                        <span className="text-[#9DA0B0] uppercase">{id.chain}</span>
                        <span className="text-[#F1F1F6] font-mono">{id.address.slice(0,8)}...{id.address.slice(-4)}</span>
                        <span className="text-[#5C6080] ml-auto">{id.confidence}% match</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* RAG Document Results */}
              {ragResults.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] font-semibold text-[#5C6080] uppercase tracking-[0.05em]">Similar Scam Patterns</p>
                  {ragResults.map((doc, i) => (
                    <div key={i} className="p-3 rounded-[10px] bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.04)]">
                      <div className="flex items-start gap-2">
                        {doc.metadata?.scam_type?.includes('rug') ? (
                          <AlertTriangle className="w-4 h-4 text-[#FF3366] flex-shrink-0 mt-0.5" />
                        ) : doc.metadata?.scam_type?.includes('honeypot') ? (
                          <AlertTriangle className="w-4 h-4 text-[#F59E0B] flex-shrink-0 mt-0.5" />
                        ) : (
                          <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                        )}
                        <div className="flex-1">
                          <p className="text-[11px] text-[#9DA0B0] leading-relaxed">{doc.excerpt}</p>
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className="text-[9px] text-[#5C6080]">Score: {doc.score.toFixed(2)}</span>
                            {doc.metadata?.scam_type && (
                              <span className="text-[9px] text-[#5C6080] bg-[rgba(255,255,255,0.03)] px-1.5 py-0.5 rounded">{doc.metadata.scam_type}</span>
                            )}
                            {doc.source && (
                              <a href={doc.source} target="_blank" rel="noopener" className="text-[9px] text-purple-400 hover:text-purple-300 flex items-center gap-1">
                                <ExternalLink className="w-3 h-3" /> Source
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
