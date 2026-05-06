import { GlassCard } from './GlassCard';

export const CandidateCard = ({ candidate, isSelected, onSelect }) => {
  return (
    <div 
      onClick={() => onSelect(candidate)}
      style={{
        cursor: 'pointer',
        transition: 'all 0.3s ease',
        transform: isSelected ? 'scale(1.02)' : 'scale(1)',
        opacity: isSelected ? 1 : 0.7,
      }}
    >
      <GlassCard 
        style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center',
          borderColor: isSelected ? 'var(--primary)' : 'var(--surface-border)',
          boxShadow: isSelected ? '0 0 20px rgba(99, 102, 241, 0.4)' : 'none'
        }}
      >
        <div style={{
          width: '120px',
          height: '120px',
          borderRadius: '50%',
          overflow: 'hidden',
          marginBottom: '16px',
          border: `3px solid ${isSelected ? 'var(--primary)' : 'transparent'}`,
          backgroundColor: 'rgba(255,255,255,0.1)'
        }}>
          {candidate.photo_url ? (
            <img 
              src={candidate.photo_url} 
              alt={candidate.full_name}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              👤
            </div>
          )}
        </div>
        
        <h3 style={{ margin: '0 0 8px 0', textAlign: 'center' }}>{candidate.full_name}</h3>
        <span style={{ 
          backgroundColor: 'var(--bg-color)', 
          border: '1px solid var(--surface-border)',
          padding: '4px 12px', 
          borderRadius: '12px',
          fontSize: '0.85rem',
          color: 'var(--text-muted)',
          fontWeight: 600
        }}>
          {candidate.party || 'Independiente'}
        </span>
        
        {candidate.description && (
          <p style={{ marginTop: '12px', fontSize: '0.9rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            {candidate.description}
          </p>
        )}
      </GlassCard>
    </div>
  );
};
