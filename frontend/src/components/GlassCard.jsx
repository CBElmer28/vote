export const GlassCard = ({ children, className = '', style = {} }) => {
  return (
    <div 
      className={`glass-panel ${className}`} 
      style={{ padding: '24px', ...style }}
    >
      {children}
    </div>
  );
};
