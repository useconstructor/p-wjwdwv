const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');
const {Temporal} = require(require.resolve('@js-temporal/polyfill',{paths:[process.cwd(),'/tmp/app']}));

// Every appointment is submitted to the supplied live HTTP server and its Turso
// persistence. No API routes or database reads are mocked. Existing records are
// preserved; only uniquely labelled QA records created here are cancelled and
// deactivated afterward. Screenshots are taken before that cleanup.
async function verify({browser, baseUrl, evidenceDir}) {
  await fs.mkdir(evidenceDir, {recursive:true});
  const checks=[]; const check=name=>checks.push({name,passed:true});
  const tag=`Prueba ficticia QA ${Date.now()} ${Math.random().toString(36).slice(2,7)}`;
  const contexts=[]; let wrapper; const created=[]; const barbers=[]; const services=[];
  async function api(url,body,method='POST',expected=200) {
    const r=await fetch(new URL(url,baseUrl),body===undefined?{}:{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    const data=await r.json(); assert.equal(r.status,expected,`${method} ${url}: ${JSON.stringify(data)}`); return data;
  }
  const original=await api('/api/settings'); const zone=original.timezone;
  const originalAgenda=await api('/api/agenda');
  const originalDetails=await Promise.all(originalAgenda.appointments.map(a=>api(`/api/appointments/${a.id}`)));
  const context=await browser.newContext({viewport:{width:390,height:844}});contexts.push(context);
  const page=await context.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const date=Temporal.Now.zonedDateTimeISO(zone).toPlainDate().add({days:30}).toString();
  const spanishDay=d=>new Intl.DateTimeFormat('es',{timeZone:'UTC',day:'numeric',month:'long',year:'numeric'}).format(new Date(d+'T12:00:00Z'));
  const ms=(d,t,z=zone)=>Temporal.ZonedDateTime.from(`${d}T${t}:00[${z}]`,{disambiguation:'reject'}).epochMilliseconds;
  const interval=Array.from({length:7},(_,weekday)=>({weekday,start:'00:00',end:'23:55'}));
  let timezoneChanged=false;
  try {
    for(const [name,width,height] of [['mobile',390,844],['tablet',768,1024],['desktop',1440,900]]) {
      await page.setViewportSize({width,height}); await page.goto(baseUrl);await page.getByRole('combobox',{name:'Barbero',exact:true}).waitFor();
      await page.getByText(`Hora de la barbería · ${zone}`,{exact:true}).waitFor();
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      if(!original.barbers.some(b=>b.active)) {
        assert.equal(await page.getByRole('combobox',{name:'Barbero',exact:true}).isDisabled(),true);
        assert.equal(await page.getByRole('combobox',{name:'Barbero',exact:true}).inputValue(),'');
        await page.getByRole('option',{name:'Sin barberos configurados',exact:true}).waitFor({state:'attached'});
        await page.getByRole('heading',{name:'Configura tu agenda para empezar'}).waitFor();
        assert.equal(await page.getByRole('link',{name:'Configurar agenda',exact:true}).count(),0);
        assert.equal(await page.getByRole('link',{name:'Completar configuración',exact:true}).count(),1);
      }
      for(const view of ['Día','Lista']) {
        await page.getByRole('button',{name:view,exact:true}).click();
        assert.equal(await page.getByRole('button',{name:view,exact:true}).getAttribute('aria-pressed'),'true');
      }
      if(name==='mobile'&&!original.barbers.some(b=>b.active)) {
        const checklist=page.getByRole('link').filter({hasText:'Cuándo se pueden reservar turnos'});
        const bounds=await checklist.boundingBox();
        assert.ok(bounds&&bounds.y+bounds.height<=height,'Complete setup checklist is visible in initial mobile viewport');
      }
      await page.screenshot({path:path.join(evidenceDir,`${name}-empty.png`),fullPage:true});
      check(`${name}: responsive agenda and configuration state`);
    }
    // Configure through the real forms, without introducing business facts.
    await page.goto(new URL('/configuracion',baseUrl).href);
    await page.getByLabel('Nombre del barbero',{exact:true}).fill(`${tag} Barbero A`);
    await page.getByRole('button',{name:'Agregar barbero',exact:true}).click();
    await page.getByText('Configuración guardada',{exact:true}).waitFor();
    let config=await api('/api/settings');barbers.push(config.barbers.find(b=>b.name===`${tag} Barbero A`));
    await api('/api/settings',{kind:'barber',name:`${tag} Barbero B`});
    config=await api('/api/settings');barbers.push(config.barbers.find(b=>b.name===`${tag} Barbero B`));
    await page.getByRole('link',{name:'Servicios',exact:true}).click();
    await page.getByLabel('Nombre del servicio',{exact:true}).fill(`${tag} Servicio corto`);
    await page.getByLabel('Duración en minutos').fill('15');
    await page.getByRole('button',{name:'Agregar servicio',exact:true}).click();
    await page.getByText('Configuración guardada',{exact:true}).waitFor();
    config=await api('/api/settings');services.push(config.services.find(s=>s.name===`${tag} Servicio corto`));
    await api('/api/settings',{kind:'service',name:`${tag} Servicio largo`,duration:60});
    config=await api('/api/settings');services.push(config.services.find(s=>s.name===`${tag} Servicio largo`));
    for(const b of barbers)await api('/api/settings',{kind:'hours',barber_id:b.id,intervals:interval});
    const barber=barbers[0].id, other=barbers[1].id, service=services[0].id;
    const body=(time,extra={})=>({barber_id:barber,service_id:service,date,time,client_name:`${tag} Cliente`,phone:'',notes:`${tag} Notas`,...extra});
    const save=async(time,extra={})=>{const r=await api('/api/appointments',body(time,extra));created.push(r.id);return r.id;};
    const snapshot=async()=>{
      const a=await api(`/api/agenda?date=${date}`),s=await api('/api/settings');
      return JSON.stringify({appointments:a.appointments,config:s});
    };
    check('Real configuration forms persist named QA barber and service; all seven weekdays configured');
    await page.setViewportSize({width:390,height:844});await page.goto(baseUrl);
    await page.getByRole('button',{name:'Reservar turno',exact:true}).waitFor();
    await page.getByRole('textbox',{name:'Fecha de la agenda'}).fill(date.split('-').reverse().join('/'));
    await page.getByRole('combobox',{name:'Barbero',exact:true}).selectOption(String(barber));
    const agendaDate=page.getByRole('textbox',{name:'Fecha de la agenda'});
    await agendaDate.fill('31/02/2026');await agendaDate.press('Tab');
    assert.equal(await agendaDate.getAttribute('aria-invalid'),'true');
    await agendaDate.fill(date.split('-').reverse().join('/'));await agendaDate.press('Tab');
    assert.equal(await agendaDate.getAttribute('aria-invalid'),'false');
    const trigger=page.getByRole('button',{name:'Reservar turno',exact:true});
    await trigger.focus();await page.keyboard.press('Enter');
    const dialog=page.getByRole('dialog');await dialog.waitFor();
    await page.keyboard.press('Tab');
    assert.equal(await dialog.evaluate(el=>el.contains(document.activeElement)),true);
    await page.keyboard.press('Shift+Tab');
    assert.equal(await dialog.evaluate(el=>el.contains(document.activeElement)),true);
    check('Keyboard opens booking and retains dialog focus; invalid calendar date corrected; both agenda views respond');
    await dialog.getByRole('combobox',{name:'Servicio',exact:true}).selectOption(String(service));
    await dialog.getByRole('combobox',{name:'Barbero',exact:true}).selectOption(String(barber));
    await dialog.getByRole('combobox',{name:'Hora',exact:true}).getByRole('option',{name:'09:00',exact:true}).waitFor({state:'attached'});
    await dialog.getByRole('button',{name:'Confirmar reserva',exact:true}).click();
    assert.equal(await dialog.locator('#booking-client_name').getAttribute('aria-invalid'),'true');
    await page.waitForFunction(()=>document.activeElement?.id==='booking-client_name');
    assert.equal(await dialog.locator('#booking-client_name').evaluate(el=>el===document.activeElement),true);
    const visibleValidation=await dialog.evaluate(el=>{
      const header=el.querySelector('[data-booking-header]').getBoundingClientRect();
      const scroll=el.querySelector('[data-booking-scroll]').getBoundingClientRect();
      return ['#booking-client_name','#error-client_name'].map(selector=>{
        const field=el.querySelector(selector),r=field.getBoundingClientRect();
        const hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
        return {selector,visible:r.top>=Math.max(header.bottom,scroll.top)&&r.bottom<=Math.min(scroll.bottom,innerHeight)&&r.left>=0&&r.right<=innerWidth,unoccluded:hit===field||field.contains(hit)};
      });
    });
    for(const field of visibleValidation){assert.equal(field.visible,true,field.selector+' must be fully visible below the header');assert.equal(field.unoccluded,true,field.selector+' must not be occluded');}
    check('Mobile invalid client input and its error are fully visible below the drawer header and receive focus');
    await page.screenshot({path:path.join(evidenceDir,'invalid-form-mobile.png'),fullPage:true});
    await dialog.locator('#booking-client_name').fill(`${tag} Cliente`);
    await dialog.getByRole('combobox',{name:'Hora',exact:true}).selectOption('09:00');
    await dialog.getByRole('textbox',{name:'Notas',exact:true}).fill(`${tag} Notas`);
    assert.equal(await dialog.locator('#booking-date-summary').innerText(),spanishDay(date));
    assert.equal(await dialog.locator('[data-booking-summary-date]').innerText(),spanishDay(date)+' · 09:00');
    await dialog.locator('[data-booking-scroll]').evaluate(el=>el.scrollTop=0);
    await page.screenshot({path:path.join(evidenceDir,'mobile-form.png'),fullPage:true});
    const response=page.waitForResponse(r=>r.url().endsWith('/api/appointments')&&r.request().method()==='POST');
    await dialog.getByRole('button',{name:'Confirmar reserva',exact:true}).click();
    const saved=await (await response).json();created.push(saved.id);await dialog.waitFor({state:'hidden'});
    const persisted=await api(`/api/appointments/${saved.id}`);
    assert.equal(persisted.client_name,`${tag} Cliente`);assert.equal(persisted.notes,`${tag} Notas`);
    assert.equal(new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).format(persisted.start),date);
    check('Spanish booking date beside native picker and reservation summary matches the persisted local appointment day');
    assert.equal(persisted.start,ms(date,'09:00'));assert.equal(persisted.end,ms(date,'09:15'));
    assert.equal(persisted.service_id,service);assert.equal(persisted.barber_id,barber);assert.equal(persisted.status,'reservado');
    check('Booking form rejects blank client with focus feedback, then saves exact UTC interval and fields');
    for(const [name,width,height] of [['mobile',390,844],['tablet',768,1024],['desktop',1440,900]]) {
      await page.setViewportSize({width,height});await page.reload();
      await page.getByRole('textbox',{name:'Fecha de la agenda'}).fill(date.split('-').reverse().join('/'));
      await page.getByRole('combobox',{name:'Barbero',exact:true}).selectOption(String(barber));
      await page.getByText(`${tag} Cliente`,{exact:true}).waitFor();
      const row=page.locator('div.group').filter({has:page.getByText(`${tag} Cliente`,{exact:true})});
      for(const text of ['09:00','a 09:15',`${tag} Servicio corto`,'Reservado'])assert.ok((await row.innerText()).includes(text));
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      await page.evaluate(()=>window.scrollTo(0,0));
      await page.screenshot({path:path.join(evidenceDir,`${name}-populated.png`),fullPage:true});
      if(name==='mobile') {const bounds=await row.boundingBox();assert.ok(bounds.y>=0&&bounds.y+80<844,'First appointment must be visible in initial mobile viewport');}
      await page.screenshot({path:path.join(evidenceDir,`${name}-populated.png`),fullPage:true});
      check(`${name}: reload retains client, service, both times and textual status; first mobile row visible`);
    }
    const before=await snapshot();
    await api('/api/appointments',body('23:50'),'POST',409);
    assert.equal(await snapshot(),before,'Booking must fit the entire configured working interval');
    for(const time of ['08:50','09:00','09:05'])await api('/api/appointments',body(time), 'POST',409);
    await api('/api/appointments',body('08:30',{service_id:services[1].id}),'POST',409);
    await api('/api/appointments',body('09:30',{client_name:'  '}),'POST',422);
    await api('/api/appointments',body('09:30',{date:'2026-02-30'}),'POST',422);
    await api('/api/appointments',body('09:30',{service_id:999999}),'POST',422);
    assert.equal(await snapshot(),before);
    check('Same-start, staggered and enclosing overlaps and invalid inputs rejected without changing saved records');
    await save('09:15');const editId=await save('10:00');const editBefore=await api(`/api/appointments/${editId}`);
    await api(`/api/appointments/${editId}`,body('09:05',{client_name:`${tag} Rejected edit`}), 'PUT',409);
    assert.deepEqual(await api(`/api/appointments/${editId}`),editBefore);
    await api(`/api/appointments/${editId}`,body('10:15'),'PUT');assert.equal((await api(`/api/appointments/${editId}`)).start,ms(date,'10:15'));
    const races=await Promise.all(['11:00','11:05'].map(async time=>{
      const r=await fetch(new URL('/api/appointments',baseUrl),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body(time))});const data=await r.json();if(r.ok)created.push(data.id);return r.status;
    }));assert.deepEqual(races.sort(),[200,409]);
    await save('09:00',{barber_id:other});
    check('Adjacent appointments and another barber accepted; overlapping edit unchanged; different-start concurrency has one winner');
    let configBefore=await snapshot();
    await api('/api/settings',{kind:'hours',barber_id:barber,intervals:[{weekday:Temporal.PlainDate.from(date).dayOfWeek%7,start:'12:00',end:'13:00'}]},'POST',409);
    await api('/api/settings',{kind:'block',barber_id:barber,start_date:date,start_time:'08:55',end_date:date,end_time:'09:10',reason:`${tag} Rejected absence`},'POST',409);
    await api('/api/settings',{kind:'timezone',timezone:'Invalid/Zone',confirm:true},'POST',422);
    await api('/api/settings',{kind:'timezone',timezone:'Europe/Madrid',confirm:false},'POST',422);
    assert.equal(await snapshot(),configBefore);
    await api('/api/settings',{kind:'block',barber_id:barber,start_date:date,start_time:'12:00',end_date:date,end_time:'13:00',reason:`${tag} Ausencia`});
    const block=(await api('/api/settings')).blocks.find(b=>b.reason===`${tag} Ausencia`);
    await api('/api/appointments',body('12:05'),'POST',409);
    const slots=await api(`/api/availability?barber=${barber}&service=${service}&date=${date}`);
    assert.ok(!slots.slots.some(s=>s.start<ms(date,'13:00')&&s.end>ms(date,'12:00')));
    await api('/api/settings',{kind:'remove_block',id:block.id});
    check('Configured hours and absences enforced; rejected configuration is atomic; availability excludes whole blocked intervals');
    // A stale form uses real server enforcement, rather than mocked conflict responses.
    await page.goto(baseUrl);await page.getByRole('button',{name:'Reservar turno',exact:true}).click();
    await dialog.getByRole('combobox',{name:'Servicio',exact:true}).selectOption(String(service));
    await dialog.getByRole('combobox',{name:'Barbero',exact:true}).selectOption(String(barber));
    await dialog.locator('input[type=date]').fill(date);
    await dialog.getByRole('combobox',{name:'Hora',exact:true}).getByRole('option',{name:'14:00',exact:true}).waitFor({state:'attached'});
    await dialog.getByRole('combobox',{name:'Hora',exact:true}).selectOption('14:00');
    await dialog.locator('#booking-client_name').fill(`${tag} Stale`);
    await save('14:00');configBefore=await snapshot();
    await dialog.getByRole('button',{name:'Confirmar reserva',exact:true}).click();await dialog.getByRole('alert').waitFor();
    assert.equal(await snapshot(),configBefore);await page.screenshot({path:path.join(evidenceDir,'dialog-conflict.png'),fullPage:true});
    await dialog.getByRole('button',{name:'Cerrar formulario'}).click();await dialog.waitFor({state:'hidden'});
    assert.equal(await page.getByRole('button',{name:'Reservar turno',exact:true}).evaluate(el=>el===document.activeElement),true);
    await page.screenshot({path:path.join(evidenceDir,'keyboard-focus.png')});
    await page.emulateMedia({reducedMotion:'reduce'});await page.getByRole('button',{name:'Reservar turno',exact:true}).click();
    assert.equal(await dialog.evaluate(el=>getComputedStyle(el).animationName),'none');await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});
    check('Stale booking displays real conflict, preserves records and restores focus; reduced-motion dialog disables animation');
    // Cross-origin parent uses an ephemeral HTTP port. The application frame,
    // fetch requests and persisted data all use the caller-supplied baseUrl.
    wrapper=http.createServer((req,res)=>{res.writeHead(200,{'Content-Type':'text/html'});res.end(`<!doctype html><html><body style="margin:0"><iframe title="Agenda embebida" src="${new URL('/',baseUrl).href.replaceAll('&','&amp;').replaceAll('"','&quot;')}" style="width:100vw;height:100vh;border:0"></iframe></body></html>`);});
    await new Promise(r=>wrapper.listen(0,'127.0.0.1',r));
    const wrapperUrl=`http://127.0.0.1:${wrapper.address().port}`;assert.notEqual(new URL(wrapperUrl).origin,new URL(baseUrl).origin);
    const embedded=await context.newPage();await embedded.goto(wrapperUrl);
    const frame=embedded.frameLocator('iframe');await frame.getByRole('button',{name:'Reservar turno',exact:true}).click();
    const fd=frame.getByRole('dialog');await fd.getByRole('combobox',{name:'Servicio',exact:true}).selectOption(String(service));
    await fd.getByRole('combobox',{name:'Barbero',exact:true}).selectOption(String(barber));await fd.locator('input[type=date]').fill(date);
    await fd.getByRole('combobox',{name:'Hora',exact:true}).getByRole('option',{name:'15:00',exact:true}).waitFor({state:'attached'});
    await fd.getByRole('combobox',{name:'Hora',exact:true}).selectOption('15:00');
    assert.equal(await fd.locator('#booking-date-summary').innerText(),spanishDay(date));
    assert.equal(await fd.locator('[data-booking-summary-date]').innerText(),spanishDay(date)+' · 15:00');
    await fd.locator('#booking-client_name').fill(`${tag} Cliente iframe`);
    await fd.locator('input[name=phone]').fill('0000000000');await fd.getByRole('textbox',{name:'Notas',exact:true}).fill(`${tag} Notas iframe`);
    const iframeResponse=embedded.waitForResponse(r=>r.url()===new URL('/api/appointments',baseUrl).href&&r.request().method()==='POST');
    await fd.getByRole('button',{name:'Confirmar reserva',exact:true}).click();const iframeSaved=await (await iframeResponse).json();created.push(iframeSaved.id);
    await fd.waitFor({state:'hidden'});
    const exact=await api(`/api/appointments/${iframeSaved.id}`);
    assert.equal(exact.client_name,`${tag} Cliente iframe`);assert.equal(exact.phone,'0000000000');assert.equal(exact.notes,`${tag} Notas iframe`);
    assert.equal(exact.service_id,service);assert.equal(exact.barber_id,barber);assert.equal(exact.service_name,services[0].name);
    assert.equal(exact.start,ms(date,'15:00'));assert.equal(exact.end,ms(date,'15:15'));assert.equal(exact.duration,15);assert.equal(exact.status,'reservado');
    const appFrame=embedded.frames().find(f=>f.parentFrame());await appFrame.goto(new URL(`/turnos/${iframeSaved.id}`,baseUrl).href);
    await frame.getByText(`${tag} Cliente iframe`,{exact:true}).waitFor();await Promise.all([appFrame.waitForNavigation(),appFrame.evaluate(()=>location.reload())]);
    for(const value of [exact.client_name,exact.phone,exact.notes,exact.service_name,'15:00','a 15:15','Reservado'])await frame.getByText(value,{exact:true}).waitFor();
    assert.deepEqual(await api(`/api/appointments/${iframeSaved.id}`),exact);
    await embedded.screenshot({path:path.join(evidenceDir,'populated-iframe-reload.png'),fullPage:true});
    check('Different-origin HTTP iframe submits real booking; frame reload retains exact client, phone, notes, service, barber, UTC instants, duration and status');
    const changedZone=zone==='Europe/Madrid'?'UTC':'Europe/Madrid';
    await api('/api/settings',{kind:'timezone',timezone:changedZone,confirm:true});timezoneChanged=true;
    assert.equal((await api('/api/settings')).timezone,changedZone);
    assert.deepEqual(await api(`/api/appointments/${saved.id}`),persisted);
    await appFrame.goto(new URL(`/turnos/${saved.id}`,baseUrl).href);
    const shifted=new Intl.DateTimeFormat('es',{timeZone:changedZone,hour:'2-digit',minute:'2-digit',hour12:false}).format(persisted.start);
    await frame.getByText(shifted,{exact:true}).waitFor();await frame.getByText(changedZone,{exact:true}).waitFor();
    // Both DST boundaries are in the future relative to the test execution.
    let year=Temporal.Now.plainDateISO().year+1;
    const lastSunday=month=>{let d=Temporal.PlainDate.from({year,month,day:31});while(d.dayOfWeek!==7)d=d.subtract({days:1});return d.toString();};
    const dstZone='Europe/Madrid';if(changedZone!==dstZone)await api('/api/settings',{kind:'timezone',timezone:dstZone,confirm:true});
    for(const dstDate of [lastSunday(3),lastSunday(10)]){
      const prior=await api(`/api/agenda?date=${dstDate}`);
      await api('/api/appointments',body('02:30',{date:dstDate}),'POST',422);
      assert.deepEqual(await api(`/api/agenda?date=${dstDate}`),prior);
      const available=await api(`/api/availability?barber=${barber}&service=${service}&date=${dstDate}`);
      assert.ok(!available.slots.some(s=>s.time==='02:30'));
    }
    await api('/api/settings',{kind:'timezone',timezone:zone,confirm:true});timezoneChanged=false;
    check('Confirmed timezone change preserves UTC instants and shifts UI time; nonexistent and ambiguous DST hours rejected and not offered');
    await page.goto(new URL(`/turnos/${editId}`,baseUrl).href);
    await page.getByRole('button',{name:'Cancelar turno',exact:true}).click();await page.getByRole('dialog').waitFor();
    await page.getByRole('button',{name:'Conservar turno',exact:true}).click();assert.equal((await api(`/api/appointments/${editId}`)).status,'reservado');
    await page.getByRole('button',{name:'Marcar como completado',exact:true}).click();await page.getByText('Turno completado',{exact:true}).waitFor();
    assert.equal((await api(`/api/appointments/${editId}`)).status,'completado');
    await page.getByRole('button',{name:'Cancelar turno',exact:true}).click();await page.getByRole('button',{name:'Confirmar cancelación',exact:true}).click();
    await page.getByText('Turno cancelado. El horario vuelve a estar disponible.',{exact:true}).waitFor();
    assert.equal((await api(`/api/appointments/${editId}`)).status,'cancelado');
    assert.ok((await api(`/api/availability?barber=${barber}&service=${service}&date=${date}`)).slots.some(s=>s.time==='10:15'));
    assert.deepEqual(errors,[]);check('Completion and confirmed cancellation persist; dismissed cancellation preserves booking; freed interval offered again; no browser runtime errors');
  } finally {
    // Do not erase earlier QA or real records. Retain this run's appointments as
    // cancelled audit records, matching the preserved candidate's convention.
    for(const n of created){const a=await api(`/api/appointments/${n}`);if(a.status!=='cancelado')await api(`/api/appointments/${n}`,{status:'cancelado'},'PATCH');}
    if(timezoneChanged)await api('/api/settings',{kind:'timezone',timezone:zone,confirm:true});
    for(const b of barbers){await api('/api/settings',{kind:'hours',barber_id:b.id,intervals:[]});await api('/api/settings',{kind:'barber',id:b.id,name:b.name,active:false});}
    for(const s of services)await api('/api/settings',{kind:'service',id:s.id,name:s.name,duration:s.duration,active:false});
    for(const c of contexts)await c.close();if(wrapper)await new Promise(r=>wrapper.close(r));
  }
  const final=await api('/api/settings');
  for(const key of ['barbers','services','hours','blocks'])assert.deepEqual(final[key].filter(x=>original[key].some(o=>o.id===x.id)),original[key]);
  assert.equal(final.timezone,zone);
  for(const a of originalDetails)assert.deepEqual(await api(`/api/appointments/${a.id}`),a);
  check('Original configuration and agenda records unchanged; only this run’s labelled QA records cancelled/deactivated');
  return {verified:true,checks};
}
module.exports={verify};
