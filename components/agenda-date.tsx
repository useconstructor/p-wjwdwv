'use client';
import {useEffect,useState} from 'react';

export const displayDate=(iso:string)=>iso.split('-').reverse().join('/');
export function AgendaDate({value,onChange}:{value:string;onChange:(iso:string)=>void}) {
 const [draft,setDraft]=useState(displayDate(value));
 const [invalid,setInvalid]=useState(false);
 useEffect(()=>{setDraft(displayDate(value));setInvalid(false);},[value]);
 function parse(text:string) {
  const match=/^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text);
  if(!match)return;
  const iso=`${match[3]}-${match[2]}-${match[1]}`;
  const date=new Date(iso+'T12:00:00Z');
  if(!Number.isNaN(date.getTime())&&date.toISOString().slice(0,10)===iso)return iso;
 }
 return <div className="min-w-0 flex-1"><input aria-label="Fecha de la agenda" aria-describedby="agenda-date-format" aria-invalid={invalid} type="text" inputMode="numeric" value={draft} maxLength={10} className="font-mono" onChange={e=>{setDraft(e.target.value);setInvalid(false);const iso=parse(e.target.value);if(iso)onChange(iso);}} onBlur={()=>setInvalid(!parse(draft))}/><span id="agenda-date-format" className={invalid?'mt-2 block text-sm text-signal':'sr-only'}>{invalid?'Escribe una fecha válida en formato día/mes/año.':'Fecha en formato día/mes/año, DD/MM/AAAA.'}</span></div>;
}
