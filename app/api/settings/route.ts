import {database} from '@/lib/db';
import {settings,saveSettings,respond} from '@/lib/server/store';
export const dynamic='force-dynamic';
export async function GET(){return respond(async()=>settings(await database()));}
export async function POST(req:Request){return respond(async()=>saveSettings(await req.json()));}
