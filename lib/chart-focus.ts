// Seleção em coordenadas de tela: uma série por vez, sem criar valores entre observações.
export function nearestChartPoint<S extends {points:P[];maxGap:number},P extends {t:number;p:number}>(
 series:S[],cursor:{x:number;y:number},x:(t:number)=>number,y:(p:number)=>number,maxTimeDistance:number,
){
 let best:{s:S;p:P;distance:number}|null=null;
 for(const s of series)for(const p of s.points){
  const dx=x(p.t)-cursor.x,dy=y(p.p)-cursor.y;
  // Não mostrar uma data distante através de lacuna sem observações.
  if(Math.abs(dx)>maxTimeDistance)continue;
  const distance=dx*dx+dy*dy;if(!best||distance<best.distance)best={s,p,distance};
 }
 return best;
}
