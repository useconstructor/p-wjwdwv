import {detail,id,saveAppointment,status,respond} from '@/lib/server/store';
type Context={params:Promise<{id:string}>};
export async function GET(_:Request,c:Context){return respond(async()=>detail(id((await c.params).id)));}
export async function PUT(req:Request,c:Context){return respond(async()=>saveAppointment(await req.json(),id((await c.params).id)));}
export async function PATCH(req:Request,c:Context){return respond(async()=>status(id((await c.params).id),(await req.json()).status));}
