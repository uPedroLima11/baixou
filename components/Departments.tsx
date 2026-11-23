'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import {Menu,ChevronDown,X} from 'lucide-react';
import {departmentOptions} from '@/lib/departments';
import type {Offer} from '@/lib/types';
export default function Departments({offers,now,onChoose}:{offers:Offer[];now:number;onChoose:(category:string,key?:string,value?:string)=>void}){
 const [open,setOpen]=useState(false),[active,setActive]=useState('');
 const root=useRef<HTMLDivElement>(null),trigger=useRef<HTMLButtonElement>(null);
 const departments=useMemo(()=>departmentOptions(offers,now),[offers,now]);
 const selected=departments.find(d=>d.id===active)??departments[0];
 useEffect(()=>{if(!open)return;const outside=(e:PointerEvent)=>{if(!root.current?.contains(e.target as Node))setOpen(false);};document.addEventListener('pointerdown',outside);return()=>document.removeEventListener('pointerdown',outside);},[open]);
 function enterCategory(id:string){setActive(id);requestAnimationFrame(()=>root.current?.querySelector<HTMLButtonElement>('.department-all')?.focus());}
 function choose(category:string,key?:string,value?:string){onChoose(category,key,value);setOpen(false);trigger.current?.focus();}
 return <div className="departments-root" ref={root} onMouseEnter={()=>{if(matchMedia('(hover: hover)').matches)setOpen(true);}} onMouseLeave={()=>setOpen(false)} onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node))setOpen(false);}} onKeyDown={e=>{if(e.key==='Escape'){setOpen(false);trigger.current?.focus();}if(e.key==='ArrowDown'&&e.target===trigger.current){e.preventDefault();setOpen(true);requestAnimationFrame(()=>root.current?.querySelector<HTMLButtonElement>('.department-category')?.focus());}}}>
  <button ref={trigger} className="departments" aria-expanded={open} aria-controls="department-navigation" onClick={()=>setOpen(true)}><Menu size={18}/>Departamentos<ChevronDown size={14}/></button>
  {open&&<div id="department-navigation" className="department-panel" aria-label="Navegação por departamentos">
   <div className="department-list">{departments.map(d=><button key={d.id} className={'department-category '+(selected?.id===d.id?'active':'')} aria-expanded={selected?.id===d.id} aria-controls="department-options" onMouseEnter={()=>setActive(d.id)} onFocus={()=>setActive(d.id)} onClick={()=>enterCategory(d.id)} onKeyDown={e=>{if(e.key==='ArrowRight'){e.preventDefault();enterCategory(d.id);}}}>{d.label}<small>{d.count}</small></button>)}</div>
   <div id="department-options" className="department-options">{selected?<><button className="department-all" onClick={()=>choose(selected.id)}>Ver todos em {selected.label} ({selected.count})</button>{selected.facets.map(f=><section key={f.key}><h3>{f.label}</h3>{f.options.map(o=><button key={o.value} onClick={()=>choose(selected.id,f.key,o.value)}>{o.label}<small>{o.count}</small></button>)}</section>)}</>:<p>Carregando os departamentos disponíveis…</p>}</div>
   <button className="department-close" aria-label="Fechar departamentos" onClick={()=>{setOpen(false);trigger.current?.focus();}}><X size={18}/></button>
  </div>}
 </div>;
}
