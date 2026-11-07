export const dateTime = (time: number) => new Date(time*1000).toLocaleString(undefined,{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});
export const shortDate = (time: number) => new Date(time*1000).toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'});
export const rankName = (badge?: number | null) => {
 if(badge == null)return 'Rank unavailable';
 if(!badge)return 'Unranked';
 const tiers=['','Initiate','Seeker','Alchemist','Arcanist','Ritualist','Emissary','Archon','Oracle','Phantom','Ascendant','Eternus'];
 return (tiers[Math.floor(badge/10)] || 'Unknown')+' '+(['','I','II','III','IV','V','VI'][badge%10] || '');
};
