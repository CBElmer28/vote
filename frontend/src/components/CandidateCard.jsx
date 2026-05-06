import { Vote, Shield } from 'lucide-react';

export const CandidateCard = ({ candidate, isSelected, onSelect }) => {
  return (
    <div 
      onClick={() => onSelect(candidate)}
      className={`flat-card !p-6 flex items-center justify-between gap-8 relative min-h-[160px] cursor-pointer transition-all duration-300 ${
        isSelected 
          ? 'ring-4 ring-primary-navy/20 border-primary-navy bg-primary-navy/5 scale-[1.02] shadow-2xl' 
          : 'border-surface-border hover:shadow-xl'
      }`}
    >
      {/* Left: Party Info */}
      <div className="flex items-center gap-6 flex-1 border-r border-surface-border pr-6 h-full">
        <div className={`w-16 h-16 rounded-xl flex items-center justify-center shadow-inner flex-shrink-0 transition-colors duration-300 overflow-hidden bg-white p-1 ${
          isSelected ? 'ring-2 ring-primary-navy' : 'border border-surface-border'
        }`}>
          {candidate.party_symbol_url ? (
            <img src={candidate.party_symbol_url} alt="" className="w-full h-full object-contain" />
          ) : (
            <Shield size={32} className={isSelected ? 'text-primary-navy' : 'text-primary-navy/30'} />
          )}
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-[10px] font-black text-text-muted uppercase tracking-widest">
            Organización Política
          </span>
          <h4 className="text-lg font-black text-text-main truncate mt-1">
            {candidate.party || 'Independiente'}
          </h4>
        </div>
      </div>

      {/* Center: Candidate Name */}
      <div className="flex-1.5 text-center px-4">
        <h3 className={`text-2xl font-black transition-colors duration-300 ${
          isSelected ? 'text-primary-navy' : 'text-text-main'
        }`}>
          {candidate.full_name}
        </h3>
      </div>
      
      {/* Right: Candidate Photo */}
      <div className={`w-28 h-28 rounded-2xl overflow-hidden border-4 flex-shrink-0 bg-bg-main transition-colors duration-300 ${
        isSelected ? 'border-primary-navy shadow-lg' : 'border-surface-border'
      }`}>
        {candidate.photo_url ? (
          <img 
            src={candidate.photo_url} 
            alt={candidate.full_name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-4xl opacity-30">
            👤
          </div>
        )}
      </div>

      {/* Selection Indicator */}
      {isSelected && (
        <div className="absolute -top-3 -right-3 bg-primary-navy text-white rounded-full w-9 h-9 flex items-center justify-center shadow-xl z-10 animate-in zoom-in-50 duration-300">
          <Vote size={20} />
        </div>
      )}
    </div>
  );
};
