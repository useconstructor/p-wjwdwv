import {availability,respond} from '@/lib/server/store';
export const dynamic='force-dynamic';
export async function GET(req:Request){return respond(()=>availability(new URL(req.url).searchParams));}
