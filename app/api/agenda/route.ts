import {agenda,respond} from '@/lib/server/store';
export const dynamic='force-dynamic';
export async function GET(req:Request){const p=new URL(req.url).searchParams;return respond(()=>agenda(p.get('date')||undefined,p.get('barber')||undefined));}
