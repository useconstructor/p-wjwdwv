import {saveAppointment,respond} from '@/lib/server/store';
export async function POST(req:Request){return respond(async()=>saveAppointment(await req.json()));}
