'use client';
import {useEffect,useState} from 'react';

// Barra lateral que acompanha a rolagem nos dois sentidos, sem rolagem interna:
// ao descer, ela sobe junto com o conteúdo até o último filtro ficar visível e então fica parada;
// ao subir, desce junto até o primeiro filtro aparecer. Só no layout de duas colunas (desktop).
export function useScrollingSidebar<T extends HTMLElement>(gap=16){
 const [el,ref]=useState<T|null>(null);
 useEffect(()=>{
  if(!el)return;
  const desktop=window.matchMedia('(min-width: 601px)');
  let top=gap,lastY=window.scrollY,frame=0;
  const apply=()=>{frame=0;
   if(!desktop.matches){el.style.position='';el.style.top='';return;}
   const min=Math.min(gap,window.innerHeight-el.offsetHeight-gap);
   top=Math.max(min,Math.min(gap,top-(window.scrollY-lastY)));lastY=window.scrollY;
   el.style.position='sticky';el.style.top=Math.round(top)+'px';
  };
  const schedule=()=>{if(!frame)frame=requestAnimationFrame(apply);};
  const resize=new ResizeObserver(schedule);resize.observe(el);
  window.addEventListener('scroll',schedule,{passive:true});window.addEventListener('resize',schedule);desktop.addEventListener('change',schedule);
  apply();
  return()=>{if(frame)cancelAnimationFrame(frame);resize.disconnect();window.removeEventListener('scroll',schedule);window.removeEventListener('resize',schedule);desktop.removeEventListener('change',schedule);el.style.position='';el.style.top='';};
 },[el,gap]);
 return ref;
}
