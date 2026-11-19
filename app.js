const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const cfg=window.GLP_CONFIG||{};
const configured=cfg.SUPABASE_URL&&cfg.SUPABASE_ANON_KEY&&!cfg.SUPABASE_URL.includes("TU-PROYECTO");
let sb=null,admin=false,currentCase=null,currentExam=null,examCases=[],practiceAccess=null;
const norm=s=>String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
function go(v){$$(".view").forEach(x=>x.classList.toggle("active",x.id==="view-"+v));$$(".nav").forEach(x=>x.classList.toggle("active",x.dataset.view===v));window.scrollTo({top:0,behavior:"smooth"});if(v==="biblioteca")loadCases();if(v==="docente")refreshAdmin();if(v==="generador")refreshAdmin();if(v==="cuenta")refreshAccount();}
$$(".nav").forEach(b=>b.addEventListener("click",()=>go(b.dataset.view)));
$$("[data-go]").forEach(b=>b.addEventListener("click",()=>go(b.dataset.go)));
function msg(id,t){$(id).textContent=t||""}
function escapeHTML(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
if(configured&&window.supabase)sb=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY);
else {msg("#login-message","Falta configurar config.js con la URL y la clave pública (anon/publishable) de Supabase.");$("#case-grid").innerHTML='<div class="empty">La biblioteca se activará cuando se configure Supabase.</div>';}
function requireBackend(){if(!sb){alert("Primero configurá Supabase siguiendo CONFIGURACION_SUPABASE.md.");return false}return true}
async function loadCases(){
 if(!sb)return;
 const search=norm($("#case-search").value),difficulty=$("#difficulty-filter").value;
 let q=sb.from("glp_cases").select("id,code,title,description,difficulty,format,areas,skills,prompt,image_path,created_at").eq("status","published").order("created_at",{ascending:false});
 if(difficulty)q=q.eq("difficulty",difficulty);
 const {data,error}=await q;
 if(error){$("#case-grid").innerHTML='<div class="empty">No se pudo cargar la biblioteca. Revisá la configuración y las políticas de Supabase.</div>';return}
 const rows=(data||[]).filter(c=>!search||norm([c.title,c.description,(c.areas||[]).join(" "),(c.skills||[]).join(" ")].join(" ")).includes(search));
 $("#case-count").textContent=`${rows.length} ${rows.length===1?"caso":"casos"}`;
 $("#case-grid").innerHTML=rows.length?rows.map(c=>`<article class="case-card"><img data-case-image="${escapeHTML(c.id)}" alt="Pedido anonimizado"><div class="case-body"><span class="tag">${escapeHTML(c.difficulty)}</span><span class="tag">${escapeHTML(c.format)}</span><h3>${escapeHTML(c.title)}</h3><p>${escapeHTML(c.description||c.prompt||"Ejercicio de lectura de pedidos.")}</p><div>${(c.areas||[]).slice(0,3).map(x=>`<span class="tag">${escapeHTML(x)}</span>`).join("")}</div><button class="btn primary" data-open-case="${c.id}">Practicar →</button></div></article>`).join(""):'<div class="empty">Todavía no hay pedidos publicados. Volvé más adelante.</div>';
 for(const c of rows){const img=$(`[data-case-image="${c.id}"]`);if(img)img.src=await imageURL(c.image_path)}
 $$("[data-open-case]").forEach(b=>b.addEventListener("click",()=>openCase(b.dataset.openCase)));
}
async function imageURL(path){
 if(!sb||!path)return "";
 const {data,error}=await sb.storage.from("glp-pedidos").createSignedUrl(path,3600);
 if(error){console.error("No se pudo generar el enlace temporal de la imagen:",error);return ""}
 return data.signedUrl;
}

function addDeterminationRow(prefill={}){
 const host=$("#determination-rows");
 const n=host.children.length+1;
 const row=document.createElement("div");
 row.className="determination-row";
 row.innerHTML=`<div class="row-number">${n}</div>
 <label class="sr-only">Determinación</label><input class="row-test" list="determination-options" placeholder="Ej. Hemograma" value="${escapeHTML(prefill.test||"")}">
 <label class="sr-only">Área</label><input class="row-area" placeholder="Área" value="${escapeHTML(prefill.area||"")}">
 <label class="sr-only">Muestra</label><input class="row-sample" placeholder="Muestra" value="${escapeHTML(prefill.sample||"")}">
 <label class="sr-only">Tubo / aditivo</label><input class="row-tube" placeholder="Tubo / aditivo" value="${escapeHTML(prefill.tube||"")}">
 <button type="button" class="remove-row" aria-label="Quitar determinación" title="Quitar fila">×</button>`;
 host.appendChild(row);
 row.querySelector(".remove-row").addEventListener("click",()=>{row.remove();renumberRows()});
 row.querySelector(".row-test").setAttribute("list","determination-options");
 
}
function renumberRows(){[...$("#determination-rows").children].forEach((r,i)=>r.querySelector(".row-number").textContent=i+1)}
function getWorksheetText(){
 const rows=[...$("#determination-rows").children].map((r,i)=>({
  determinacion:r.querySelector(".row-test").value.trim(),
  area:r.querySelector(".row-area").value.trim(),
  muestra:r.querySelector(".row-sample").value.trim(),
  tubo:r.querySelector(".row-tube").value.trim()
 })).filter(r=>r.determinacion||r.area||r.muestra||r.tubo);
 return [
  "DETERMINACIONES:",
  ...rows.map((r,i)=>`${i+1}. ${r.determinacion}; Área: ${r.area}; Muestra: ${r.muestra}; Tubo/aditivo: ${r.tubo}`),
  "AYUNO / PREPARACIÓN: "+$("#student-fasting").value.trim(),
  "CONDICIONES ESPECIALES: "+$("#student-special").value.trim(),
  "DUDAS / INCONSISTENCIAS / CONSULTAS: "+$("#student-observations").value.trim()
 ].join("\n");
}
function initWorksheet(){
 $("#determination-rows").innerHTML="";
 addDeterminationRow();addDeterminationRow();addDeterminationRow();
 $("#student-fasting").value="";$("#student-special").value="";$("#student-observations").value="";
 $("#evaluation-result").hidden=true;
}
$("#add-determination").addEventListener("click",()=>addDeterminationRow());

async function ensurePracticeIdentity(){
 const {data:{session}}=await sb.auth.getSession();
 if(session?.user)return session.user;
 const {data,error}=await sb.auth.signInAnonymously();
 if(error){alert('No se pudo iniciar la sesión de visitante: '+error.message);return null}
 return data.user;
}
async function openCase(id){
 if(!requireBackend())return;
 const identity=await ensurePracticeIdentity();if(!identity)return;
 const {data:access,error:accessError}=await sb.rpc('glp_start_practice',{p_case_id:id});
 if(accessError){alert('No se pudo autorizar la práctica: '+accessError.message);return}
 if(!access?.allowed){
  if(access?.reason==='no_credits')alert('Agotaste tus intentos gratuitos y no tenés créditos disponibles. Registrate o iniciá sesión para consultar tu saldo y acceder a paquetes de créditos.');
  else alert(access?.message||'No tenés intentos disponibles.');
  await refreshAccount();go('cuenta');return;
 }
 practiceAccess=access;
 const {data,error}=await sb.from("glp_cases").select("*").eq("id",id).eq("status","published").single();
 if(error||!data){alert("No se pudo abrir el caso.");return}
 currentCase=data;$("#practice-title").textContent=data.title;$("#practice-meta").textContent=`${data.code} · ${data.difficulty} · ${data.format} · ${(data.areas||[]).join(", ")}`;
 $("#practice-image").src=await imageURL(data.image_path);$("#practice-caption").textContent=data.transcription?"Transcripción docente disponible después de resolver el ejercicio.":"Observá el documento completo antes de responder.";
 $("#practice-prompt").textContent=data.prompt;initWorksheet();go("practica");
}
$("#evaluate").addEventListener("click",async()=>{
 if(!currentCase||!requireBackend())return;
 const answer=getWorksheetText();const filled=[...$("#determination-rows").children].filter(r=>r.querySelector(".row-test").value.trim());
 if(!filled.length){alert("Agregá al menos una determinación antes de enviar.");return}
 if(answer.trim().length<3){alert("Completá tu resolución antes de corregir.");return}
 $("#evaluate").disabled=true;$("#evaluate").textContent="Corrigiendo…";
 const {data,error}=await sb.rpc("glp_evaluate_case",{p_case_id:currentCase.id,p_answer:answer});
 $("#evaluate").disabled=false;$("#evaluate").textContent="Enviar respuesta y corregir";
 const box=$("#evaluation-result");box.hidden=false;
 if(error){box.className="result bad";box.textContent="No se pudo corregir la respuesta. "+error.message;return}
 box.className="result"+(data.score<70?" bad":"");
 box.innerHTML=`<b>Reconocimiento de determinaciones: ${data.score}%</b><br>Coincidencias: ${data.matched.length?data.matched.map(escapeHTML).join(", "):"No se reconocieron coincidencias."}<br>${data.missing.length?"Para revisar: "+data.missing.map(escapeHTML).join(", ")+"<br>":""}<br><b>Devolución docente</b><br>${escapeHTML(data.explanation||"Revisá la resolución del caso.")}${data.transcription?`<br><br><b>Transcripción docente</b><br>${escapeHTML(data.transcription)}`:""}<br><br><small>La puntuación automática de esta versión corresponde al reconocimiento de las determinaciones esperadas. Los campos de área, muestra, tubo y fase preanalítica se muestran para autoevaluación y todavía no tienen corrección automática independiente.</small>`;
});
$("#case-search").addEventListener("input",loadCases);$("#difficulty-filter").addEventListener("change",loadCases);

// Registro y acceso de alumnos: Supabase Auth. Los privilegios nunca se asignan desde el navegador.
async function refreshAccount(){
 if(!sb)return;
 const {data:{session}}=await sb.auth.getSession();
 const user=session?.user||null,anonymous=!!user?.is_anonymous,logged=!!user&&!anonymous;
 $('#auth-panel').hidden=logged;$('#account-workspace').hidden=!logged;
 $('#guest-credit-panel').hidden=!anonymous;
 $('#account-status').textContent=logged?'Cuenta activa':anonymous?'Visitante':'Visitante';
 if(!user){$('#guest-credit-panel').hidden=true;return}
 if(anonymous){await loadPracticeStatus(true);return}
 const {data:profile}=await sb.from('glp_profiles').select('display_name,access_level').eq('user_id',user.id).maybeSingle();
 $('#profile-name').textContent=profile?.display_name||user.user_metadata?.display_name||user.email;
 $('#profile-level').textContent=({free:'Cuenta gratuita',student:'Alumno habilitado',teacher:'Docente',institution:'Colaborador institucional',admin:'Administrador'})[profile?.access_level||'free'];
 await loadPracticeStatus(false);
 await loadStudentExams();
}
async function loadPracticeStatus(guest=false){
 const {data,error}=await sb.rpc('glp_get_practice_status');
 if(error){if(!guest)msg('#credit-status-message','No se pudo consultar el saldo: '+error.message);else msg('#guest-credit-summary','Tenés 1 intento gratuito diario. Para ver tu saldo, registrate.');return}
 const free=Number(data.free_remaining??0),balance=Number(data.credit_balance??0);
 if(guest){$('#guest-credit-summary').textContent=`Te quedan ${free} de 1 intento gratuito hoy. Creá una cuenta para tener 3 intentos diarios y guardar tu progreso.`;return}
 $('#free-attempts').textContent=data.unlimited?'Ilimitados':`${free} / 3`;
 $('#credit-balance').textContent=balance;
 $('#practice-access-label').textContent=data.unlimited?(data.access_type==='teacher'?'Docente':'Alumno de comisión'):'Cuenta gratuita';
 msg('#credit-status-message',data.unlimited?'Tenés acceso ilimitado mientras esté vigente tu comisión.':free>0?'Primero se utilizan tus intentos gratuitos; después se descuentan créditos.':'Agotaste los intentos gratuitos de hoy. Se utilizará 1 crédito por práctica.');
 const {data:tx,error:te}=await sb.from('glp_credit_transactions').select('id,amount,transaction_type,description,created_at').order('created_at',{ascending:false}).limit(8);
 const host=$('#credit-history');if(te){host.textContent='No se pudo cargar el historial.';return}
 host.innerHTML=tx?.length?tx.map(t=>`<div class="credit-history-row"><span>${escapeHTML(t.description||t.transaction_type)}<small>${new Date(t.created_at).toLocaleString('es-AR')}</small></span><b class="${t.amount>=0?'credit-positive':'credit-negative'}">${t.amount>0?'+':''}${t.amount}</b></div>`).join(''):'<div class="empty">Todavía no hay movimientos de créditos.</div>';
}
$('#register-form').addEventListener('submit',async e=>{
 e.preventDefault();if(!requireBackend())return;
 const {data:{session:priorSession}}=await sb.auth.getSession();if(priorSession?.user?.is_anonymous)await sb.auth.signOut();
 const name=$('#reg-name').value.trim(),email=$('#reg-email').value.trim(),password=$('#reg-password').value;
 if(name.length<3){msg('#register-message','Ingresá tu nombre y apellido.');return}
 msg('#register-message','Creando cuenta…');
 const {data,error}=await sb.auth.signUp({email,password,options:{data:{display_name:name}}});
 if(error){msg('#register-message',error.message);return}
 if(data.user){
  const {error:pe}=await sb.from('glp_profiles').upsert({user_id:data.user.id,display_name:name,email,access_level:'free'},{onConflict:'user_id'});
  if(pe)console.warn('El perfil se completará al iniciar sesión:',pe.message);
 }
 msg('#register-message',data.session?'Cuenta creada. Ya podés ingresar.':'Cuenta creada. Revisá tu correo para confirmar el registro y luego iniciá sesión.');
});
$('#signin-form').addEventListener('submit',async e=>{e.preventDefault();if(!requireBackend())return;msg('#signin-message','Ingresando…');const {error}=await sb.auth.signInWithPassword({email:$('#signin-email').value.trim(),password:$('#signin-password').value});msg('#signin-message',error?error.message:'Sesión iniciada.');if(!error){await ensureProfile();await refreshAccount()}});
async function ensureProfile(){const {data:{user}}=await sb.auth.getUser();if(!user)return;const name=user.user_metadata?.display_name||'';await sb.from('glp_profiles').upsert({user_id:user.id,display_name:name,email:user.email,access_level:'free'},{onConflict:'user_id',ignoreDuplicates:true});}
$('#reset-password').addEventListener('click',async()=>{if(!requireBackend())return;const email=$('#signin-email').value.trim();if(!email){msg('#signin-message','Ingresá primero tu correo electrónico.');return}const {error}=await sb.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname});msg('#signin-message',error?'No se pudo enviar el correo: '+error.message:'Si el correo está registrado, recibirás instrucciones para restablecer la contraseña.')});
$('#account-logout').addEventListener('click',async()=>{await sb.auth.signOut();await refreshAccount()});
$('#join-cohort-form').addEventListener('submit',async e=>{e.preventDefault();const code=$('#cohort-code').value.trim();msg('#join-message','Verificando código…');const {data,error}=await sb.rpc('glp_join_cohort_by_code',{p_code:code});msg('#join-message',error?error.message:(data?.message||'Inscripción procesada.'));if(!error){$('#cohort-code').value='';await refreshAccount()}});
async function loadStudentExams(){
 const host=$('#student-exams');host.textContent='Cargando evaluaciones…';
 const {data:members,error}=await sb.from('glp_cohort_members').select('cohort_id,status').eq('status','active');
 if(error){host.textContent='No se pudieron consultar tus comisiones. '+error.message;return}
 if(!members?.length){host.innerHTML='<div class="empty">Todavía no estás vinculado a una comisión. Solicitá un código de inscripción a tu docente.</div>';return}
 const ids=members.map(x=>x.cohort_id);const {data:exams, error:ee}=await sb.from('glp_exams').select('id,title,instructions,cohort_id,opens_at,closes_at,status,allow_catalog').in('cohort_id',ids).eq('status','published');
 if(ee){host.textContent='No se pudieron cargar las evaluaciones: '+ee.message;return}
 host.innerHTML=exams?.length?exams.map(x=>`<div class="admin-item"><b>${escapeHTML(x.title)}</b><small>${escapeHTML(x.instructions||'Evaluación integradora de cinco pedidos')}</small><button class="btn primary" data-exam="${x.id}">Comenzar →</button></div>`).join(''):'<div class="empty">No hay evaluaciones publicadas para tus comisiones.</div>';
 $$('[data-exam]').forEach(b=>b.addEventListener('click',()=>openExam(b.dataset.exam)));
 const {data:{user}}=await sb.auth.getUser();
 const hist=$('#student-submissions');hist.textContent='Cargando entregas…';
 const {data:subs,error:he}=await sb.from('glp_submissions').select('id,exam_id,attempt_no,status,submitted_at,total_score,passed,teacher_feedback').eq('student_id',user.id).order('submitted_at',{ascending:false});
 if(he){hist.textContent='No se pudo cargar el historial: '+he.message;return}
 if(!subs?.length){hist.innerHTML='<div class="empty">Todavía no realizaste entregas.</div>';return}
 const exids=[...new Set(subs.map(x=>x.exam_id))];const {data:exnames}=await sb.from('glp_exams').select('id,title').in('id',exids);const en=Object.fromEntries((exnames||[]).map(x=>[x.id,x.title]));
 hist.innerHTML=subs.map(s=>`<div class="admin-item"><b>${escapeHTML(en[s.exam_id]||'Evaluación')}</b><small>Intento ${s.attempt_no} · ${escapeHTML(s.status)} · ${new Date(s.submitted_at).toLocaleString('es-AR')}</small>${s.total_score!==null?`<small>Calificación: ${s.total_score}/100 · ${s.passed?'Aprobado':'No aprobado'}</small>`:''}${s.teacher_feedback?`<p>${escapeHTML(s.teacher_feedback)}</p>`:''}${s.status==='returned'?'<small>El docente solicitó correcciones. Podés volver a realizar y enviar la evaluación.</small>':''}</div>`).join('');
}
async function openExam(id){
 const {data:exam,error}=await sb.from('glp_exams').select('*').eq('id',id).single();if(error||!exam){alert(error?.message||'No se encontró la evaluación.');return}
 const {data:links,error:le}=await sb.from('glp_exam_cases').select('case_id,position').eq('exam_id',id).order('position');if(le||!links||links.length!==5){alert('La evaluación todavía no tiene exactamente cinco pedidos configurados.');return}
 const {data:cases,error:ce}=await sb.from('glp_cases').select('id,code,title,description,prompt,image_path').in('id',links.map(x=>x.case_id));if(ce){alert(ce.message);return}
 currentExam=exam;examCases=links.map(l=>cases.find(c=>c.id===l.case_id)).filter(Boolean);
 if(examCases.length!==5){alert('No se pudieron recuperar los cinco pedidos.');return}
 $('#exam-title').textContent=exam.title;$('#exam-instructions').textContent=(exam.instructions||'Resolvé los cinco pedidos.')+(exam.allow_catalog?' Podés consultar GuiaLab durante la resolución.':' No está permitido consultar GuiaLab durante esta evaluación.');
 $('#exam-case-list').innerHTML=examCases.map((c,i)=>`<article class="form-card exam-case"><h3>Pedido ${i+1}: ${escapeHTML(c.title)}</h3><p>${escapeHTML(c.prompt||c.description||'Interpretá el pedido.')}</p><img id="exam-img-${i}" class="exam-image" alt="Pedido educativo ${i+1}"><label>Transcripción y determinaciones<textarea class="exam-answer" data-answer="${c.id}" rows="4" placeholder="Determinaciones, áreas, muestra, tubo y requisitos preanalíticos…"></textarea></label></article>`).join('');
 for(let i=0;i<examCases.length;i++)$('#exam-img-'+i).src=await imageURL(examCases[i].image_path);
 $('#exam-submit-message').textContent='';go('examen');
}
$('#submit-exam').addEventListener('click',async()=>{
 if(!currentExam||!sb)return;
 const answers=$$('.exam-answer');if(answers.length!==5||answers.some(x=>!x.value.trim())){msg('#exam-submit-message','Completá los cinco pedidos antes de entregar.');return}
 const {data:{user}}=await sb.auth.getUser();if(!user){msg('#exam-submit-message','Iniciá sesión para entregar el examen.');return}
 const now=Date.now();if(currentExam.opens_at&&now<new Date(currentExam.opens_at).getTime()){msg('#exam-submit-message','La evaluación todavía no está abierta.');return}if(currentExam.closes_at&&now>new Date(currentExam.closes_at).getTime()){msg('#exam-submit-message','El plazo de esta evaluación finalizó.');return}
 const {data:existing,error:exErr}=await sb.from('glp_submissions').select('id,attempt_no,status').eq('exam_id',currentExam.id).eq('student_id',user.id).order('attempt_no',{ascending:false}).limit(1).maybeSingle();
 if(exErr){msg('#exam-submit-message','No se pudo verificar el intento anterior: '+exErr.message);return}
 if(existing&&existing.status!=='returned'){msg('#exam-submit-message','Ya entregaste esta evaluación. Esperá la devolución docente.');return}
 const attempt=(existing?.attempt_no||0)+1;
 const btn=$('#submit-exam');btn.disabled=true;btn.textContent='Enviando…';
 const {data:submission,error}=await sb.from('glp_submissions').insert({exam_id:currentExam.id,student_id:user.id,attempt_no:attempt,status:existing?'resubmitted':'submitted'}).select('id').single();
 if(error){btn.disabled=false;btn.textContent='Entregar examen';msg('#exam-submit-message','No se pudo crear la entrega: '+error.message);return}
 const payload=answers.map(x=>({submission_id:submission.id,case_id:x.dataset.answer,answer:{response:x.value},transcription:x.value}));
 const {error:ae}=await sb.from('glp_submission_answers').insert(payload);
 if(ae){await sb.from('glp_submissions').delete().eq('id',submission.id);btn.disabled=false;btn.textContent='Entregar examen';msg('#exam-submit-message','No se guardaron las respuestas: '+ae.message);return}
 msg('#exam-submit-message','Examen entregado correctamente. La sesión de resolución terminó. Podrás consultar la devolución cuando el docente la publique.');btn.textContent='Examen entregado';
});


// Gestión de comisiones: administrador/docente único de esta etapa.
function makeCohortCode(){return 'GLP-'+Math.random().toString(36).slice(2,6).toUpperCase()+'-'+Math.random().toString(36).slice(2,6).toUpperCase()}
async function loadTeacherCohorts(){
 const host=$('#teacher-cohorts');if(!admin||!sb)return;
 host.textContent='Cargando comisiones…';
 const {data,error}=await sb.from('glp_cohorts').select('id,name,description,access_code,starts_on,ends_on,status,created_at').order('created_at',{ascending:false});
 if(error){host.textContent='No se pudieron cargar las comisiones: '+error.message;return}
 if(!data?.length){host.innerHTML='<div class="empty">Todavía no creaste comisiones. Usá el formulario para crear la primera.</div>';return}
 const counts={};
 const ids=data.map(c=>c.id);
 const {data:members}=await sb.from('glp_cohort_members').select('cohort_id,status').in('cohort_id',ids);
 (members||[]).forEach(m=>{counts[m.cohort_id]=(counts[m.cohort_id]||0)+(m.status==='active'?1:0)});
 host.innerHTML=data.map(c=>`<div class="admin-item"><b>${escapeHTML(c.name)}</b><small>${escapeHTML(c.status)} · ${(counts[c.id]||0)} alumnos activos${c.starts_on?' · desde '+escapeHTML(c.starts_on):''}${c.ends_on?' · hasta '+escapeHTML(c.ends_on):''}</small><div class="cohort-code"><code>${escapeHTML(c.access_code||'Sin código')}</code><button type="button" class="btn secondary" data-copy-cohort="${escapeHTML(c.access_code||'')}">Copiar código</button></div><button type="button" class="btn primary" data-roster="${c.id}" data-name="${escapeHTML(c.name)}" data-code="${escapeHTML(c.access_code||'')}">Ver alumnos</button><button type="button" class="btn secondary" data-archive="${c.id}" data-status="${c.status}">${c.status==='active'?'Archivar':'Reactivar'}</button></div>`).join('');
 $$('[data-copy-cohort]').forEach(b=>b.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(b.dataset.copyCohort);b.textContent='Copiado';setTimeout(()=>b.textContent='Copiar código',1400)}catch{msg('#cohort-create-message','No se pudo copiar automáticamente. Seleccioná el código y copialo.')}}));
 $$('[data-roster]').forEach(b=>b.addEventListener('click',()=>loadCohortRoster(b.dataset.roster,b.dataset.name,b.dataset.code)));
 $$('[data-archive]').forEach(b=>b.addEventListener('click',()=>setCohortStatus(b.dataset.archive,b.dataset.status)));
}
$('#cohort-form').addEventListener('submit',async e=>{
 e.preventDefault();if(!requireBackend()||!admin)return;
 const name=$('#cohort-name').value.trim(),start=$('#cohort-start').value||null,end=$('#cohort-end').value||null;
 if(!name){msg('#cohort-create-message','Ingresá un nombre para la comisión.');return}
 if(start&&end&&end<start){msg('#cohort-create-message','La fecha de finalización no puede ser anterior al inicio.');return}
 const {data:{user}}=await sb.auth.getUser();if(!user){msg('#cohort-create-message','La sesión docente expiró. Volvé a ingresar.');return}
 const button=$('#create-cohort');button.disabled=true;button.textContent='Creando…';msg('#cohort-create-message','');
 let code=makeCohortCode(),result;
 for(let i=0;i<3;i++){result=await sb.from('glp_cohorts').insert({name,description:$('#cohort-description').value.trim(),owner_id:user.id,access_code:code,starts_on:start,ends_on:end,status:'active'}).select('id').single();if(!result.error||!String(result.error.message).toLowerCase().includes('duplicate'))break;code=makeCohortCode()}
 button.disabled=false;button.textContent='Crear comisión y generar código';
 if(result.error){msg('#cohort-create-message','No se pudo crear la comisión: '+result.error.message);return}
 msg('#cohort-create-message','Comisión creada. Código de inscripción: '+code);$('#cohort-form').reset();await loadTeacherCohorts();
});
async function loadCohortRoster(id,name,code){
 const card=$('#cohort-roster-card'),host=$('#cohort-roster');card.hidden=false;$('#roster-title').textContent='Alumnos · '+name;$('#roster-code').textContent='Código de inscripción: '+code;host.textContent='Cargando alumnos…';
 const {data:members,error}=await sb.from('glp_cohort_members').select('user_id,status,enrolled_at').eq('cohort_id',id).order('enrolled_at',{ascending:false});
 if(error){host.textContent='No se pudieron consultar los alumnos: '+error.message;return}
 if(!members?.length){host.innerHTML='<div class="empty">Todavía no hay alumnos inscriptos en esta comisión.</div>';card.scrollIntoView({behavior:'smooth',block:'start'});return}
 const userIds=members.map(m=>m.user_id);const {data:profiles}=await sb.from('glp_profiles').select('user_id,display_name,email,access_level').in('user_id',userIds);
 const byId=Object.fromEntries((profiles||[]).map(p=>[p.user_id,p]));
 host.innerHTML=members.map(m=>{const p=byId[m.user_id]||{};return `<div class="admin-item"><b>${escapeHTML(p.display_name||p.email||'Alumno')}</b><small>${escapeHTML(p.email||m.user_id)} · Inscripción: ${new Date(m.enrolled_at).toLocaleDateString('es-AR')} · ${escapeHTML(m.status)}</small><button type="button" class="btn secondary" data-member="${m.user_id}" data-cohort="${id}" data-next="${m.status==='active'?'disabled':'active'}">${m.status==='active'?'Deshabilitar acceso':'Habilitar acceso'}</button></div>`}).join('');
 $$('[data-member]').forEach(b=>b.addEventListener('click',()=>setMemberStatus(b.dataset.cohort,b.dataset.member,b.dataset.next,name,code)));
 card.scrollIntoView({behavior:'smooth',block:'start'});
}
async function setMemberStatus(cohort,user,status,name,code){const {error}=await sb.from('glp_cohort_members').update({status}).eq('cohort_id',cohort).eq('user_id',user);if(error){alert('No se pudo actualizar el acceso: '+error.message);return}await loadCohortRoster(cohort,name,code);await loadTeacherCohorts()}
async function setCohortStatus(id,status){const next=status==='active'?'archived':'active';const {error}=await sb.from('glp_cohorts').update({status:next}).eq('id',id);if(error){alert('No se pudo actualizar la comisión: '+error.message);return}await loadTeacherCohorts()}
$('#close-roster').addEventListener('click',()=>{$('#cohort-roster-card').hidden=true});

$('#admin-credit-form').addEventListener('submit',async e=>{e.preventDefault();if(!admin||!sb)return;const amount=Number($('#credit-amount').value),uid=$('#credit-user-id').value.trim(),reason=$('#credit-reason').value.trim();if(!Number.isInteger(amount)||amount<1){msg('#admin-credit-message','Ingresá una cantidad válida.');return}msg('#admin-credit-message','Procesando…');const {data,error}=await sb.rpc('glp_admin_grant_credits',{p_user_id:uid,p_amount:amount,p_description:reason||'Créditos otorgados por administración'});msg('#admin-credit-message',error?'No se pudieron otorgar los créditos: '+error.message:`Se acreditaron ${data?.amount||amount} créditos. Saldo actual: ${data?.balance??'consultá la cuenta del usuario'}.`)});

async function refreshAdmin(){
 if(!sb)return;
 const {data}=await sb.auth.getSession();
 admin=false;
 if(data.session){
  const role=await sb.from("glp_admins").select("user_id").eq("user_id",data.session.user.id).maybeSingle();
  admin=!!role.data;
  if(!admin)msg("#login-message","Esta cuenta inició sesión, pero no tiene permisos docentes.");
 }
 $("#admin-login").hidden=admin;$("#admin-workspace").hidden=!admin;$("#admin-status").textContent=admin?"Sesión docente":"No autenticado";
 if(admin){loadAdminCases();loadTeacherCohorts();loadTeacherExams();loadExamBuilderOptions();}
}
$("#login-button").addEventListener("click",async()=>{
 if(!requireBackend())return;
 msg("#login-message","Verificando…");
 const {error}=await sb.auth.signInWithPassword({email:$("#admin-email").value,password:$("#admin-password").value});
 msg("#login-message",error?error.message:"Acceso correcto.");if(!error)refreshAdmin();
});
$("#logout-button").addEventListener("click",async()=>{await sb.auth.signOut();refreshAdmin()});
async function loadAdminCases(){
 const {data,error}=await sb.from("glp_cases").select("id,code,title,difficulty,status,created_at").order("created_at",{ascending:false});
 if(error){$("#admin-case-list").textContent="No se pudieron cargar los casos: "+error.message;return}
 $("#admin-case-list").innerHTML=data.length?data.map(c=>`<div class="admin-item"><b>${escapeHTML(c.title)}</b><small>${escapeHTML(c.code)} · ${escapeHTML(c.difficulty)} · ${escapeHTML(c.status)}</small><button class="btn secondary" data-toggle="${c.id}" data-status="${c.status}">${c.status==="published"?"Retirar":"Publicar"}</button><button class="btn secondary" data-delete="${c.id}">Eliminar</button></div>`).join(""):'<div class="empty">Todavía no cargaste pedidos.</div>';
 $$("[data-toggle]").forEach(b=>b.addEventListener("click",()=>toggleStatus(b.dataset.toggle,b.dataset.status)));
 $$("[data-delete]").forEach(b=>b.addEventListener("click",()=>deleteCase(b.dataset.delete)));
}
async function toggleStatus(id,status){
 const next=status==="published"?"draft":"published";
 const {error}=await sb.from("glp_cases").update({status:next}).eq("id",id);
 if(error)alert(error.message);else{loadAdminCases();loadCases()}
}
async function deleteCase(id){
 if(!confirm("¿Eliminar este caso? Esta acción no se puede deshacer."))return;
 const {data}=await sb.from("glp_cases").select("image_path").eq("id",id).single();
 const {error}=await sb.from("glp_cases").delete().eq("id",id);
 if(error){alert(error.message);return}
 if(data?.image_path)await sb.storage.from("glp-pedidos").remove([data.image_path]);
 loadAdminCases();loadCases();
}
function splitCSV(s){return s.split(/[,;\n]/).map(x=>x.trim()).filter(Boolean)}
async function sanitizeImage(file){
 // Re-encode through canvas to strip EXIF metadata (including embedded GPS tags).
 // This does NOT remove visible text or identifiers from the photograph.
 const bitmap=await createImageBitmap(file);
 const scale=Math.min(1,2400/Math.max(bitmap.width,bitmap.height));
 const canvas=document.createElement("canvas");
 canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);
 const ctx=canvas.getContext("2d");ctx.fillStyle="#fff";ctx.fillRect(0,0,canvas.width,canvas.height);
 ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();
 return await new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error("No se pudo procesar la imagen.")),"image/jpeg",0.88));
}
$("#case-form").addEventListener("submit",async e=>{
 e.preventDefault();if(!requireBackend()||!admin)return;
 const file=$("#case-image").files[0];if(!file){msg("#save-message","Seleccioná una imagen.");return}
 if(!["image/jpeg","image/png","image/webp"].includes(file.type)){msg("#save-message","Formato no admitido.");return}
 if(file.size>8*1024*1024){msg("#save-message","La imagen supera el límite de 8 MB.");return}
 if(!confirm("Confirmo que tengo autorización para usar esta imagen y que fue revisada para eliminar todos los datos identificatorios."))return;
 const button=$("#save-case");button.disabled=true;button.textContent="Subiendo imagen…";msg("#save-message","");
 const ext=file.type==="image/png"?"png":file.type==="image/webp"?"webp":"jpg";
 const path=`${crypto.randomUUID()}.jpg`;
 let safeFile;
 try{safeFile=await sanitizeImage(file)}catch(err){msg("#save-message","No se pudo procesar la imagen: "+err.message);button.disabled=false;button.textContent="Guardar pedido";return}
 let {error}=await sb.storage.from("glp-pedidos").upload(path,safeFile,{contentType:"image/jpeg",upsert:false});
 if(error){msg("#save-message","Error al subir imagen: "+error.message);button.disabled=false;button.textContent="Guardar pedido";return}
 const code="GLP-"+new Date().toISOString().slice(0,10).replaceAll("-","")+"-"+Math.random().toString(36).slice(2,6).toUpperCase();
 const payload={code,title:$("#case-title").value.trim(),description:$("#case-prompt").value.trim().slice(0,180),difficulty:$("#case-difficulty").value,format:$("#case-format").value,areas:splitCSV($("#case-areas").value),skills:splitCSV($("#case-skills").value),prompt:$("#case-prompt").value.trim(),image_path:path,status:$("#case-publish").checked?"published":"draft"};
 const inserted=await sb.from("glp_cases").insert(payload).select("id").single();
 if(inserted.error){await sb.storage.from("glp-pedidos").remove([path]);msg("#save-message","Error al guardar el caso: "+inserted.error.message)}
 else{
  const terms=splitCSV($("#case-terms").value);
  const key=await sb.from("glp_answer_keys").insert({case_id:inserted.data.id,expected_terms:terms,explanation:$("#case-explanation").value.trim(),transcription:$("#case-transcription").value.trim()});
  if(key.error){await sb.from("glp_cases").delete().eq("id",inserted.data.id);await sb.storage.from("glp-pedidos").remove([path]);msg("#save-message","No se pudo guardar la clave de corrección. Se revirtió el caso: "+key.error.message)}
  else{msg("#save-message","Pedido guardado correctamente.");$("#case-form").reset();loadAdminCases();loadCases()}
 }
 button.disabled=false;button.textContent="Guardar pedido";
});

// Constructor de evaluaciones, bandeja de entregas y corrección docente.
async function loadExamBuilderOptions(){
 if(!admin||!sb)return;
 const [co,ca]=await Promise.all([
  sb.from('glp_cohorts').select('id,name').eq('status','active').order('created_at',{ascending:false}),
  sb.from('glp_cases').select('id,title,code,difficulty').eq('status','published').order('created_at',{ascending:false})
 ]);
 const cohortSel=$('#exam-cohort');cohortSel.innerHTML='<option value="">Seleccioná una comisión activa</option>'+(co.data||[]).map(x=>`<option value="${x.id}">${escapeHTML(x.name)}</option>`).join('');
 const host=$('#exam-case-options');host.innerHTML=ca.data?.length?ca.data.map(x=>`<label class="exam-option"><input type="checkbox" value="${x.id}" class="exam-case-check"><span><b>${escapeHTML(x.title)}</b><small>${escapeHTML(x.code)} · ${escapeHTML(x.difficulty)}</small></span></label>`).join(''):'<p class="empty">No hay pedidos publicados. Publicá al menos cinco en la biblioteca.</p>';
}
$('#exam-form').addEventListener('submit',async e=>{
 e.preventDefault();if(!admin||!sb)return;
 const selected=$$('.exam-case-check:checked').map(x=>x.value);
 if(selected.length!==5){msg('#exam-create-message',`Seleccionaste ${selected.length}. Debés elegir exactamente cinco pedidos.`);return}
 const cohort=$('#exam-cohort').value;if(!cohort){msg('#exam-create-message','Seleccioná una comisión.');return}
 const opens=$('#exam-opens').value?new Date($('#exam-opens').value).toISOString():null;
 const closes=$('#exam-closes').value?new Date($('#exam-closes').value).toISOString():null;
 if(opens&&closes&&new Date(closes)<=new Date(opens)){msg('#exam-create-message','La fecha de cierre debe ser posterior a la apertura.');return}
 const {data:{user}}=await sb.auth.getUser();const btn=$('#save-exam');btn.disabled=true;btn.textContent='Guardando…';
 const {data:exam,error}=await sb.from('glp_exams').insert({title:$('#exam-name').value.trim(),instructions:$('#exam-instructions-input').value.trim(),owner_id:user.id,cohort_id:cohort,opens_at:opens,closes_at:closes,allow_catalog:$('#exam-allow-catalog').checked,passing_score:70,status:'draft'}).select('id').single();
 if(error){msg('#exam-create-message','No se pudo crear la evaluación: '+error.message);btn.disabled=false;btn.textContent='Guardar evaluación como borrador';return}
 const links=selected.map((id,i)=>({exam_id:exam.id,case_id:id,position:i+1}));const {error:le}=await sb.from('glp_exam_cases').insert(links);
 if(le){await sb.from('glp_exams').delete().eq('id',exam.id);msg('#exam-create-message','No se pudieron asociar los cinco pedidos: '+le.message);btn.disabled=false;btn.textContent='Guardar evaluación como borrador';return}
 msg('#exam-create-message','Evaluación guardada como borrador. Revisala y publicala cuando esté lista.');$('#exam-form').reset();$('#exam-allow-catalog').checked=true;btn.disabled=false;btn.textContent='Guardar evaluación como borrador';await loadExamBuilderOptions();await loadTeacherExams();
});
async function loadTeacherExams(){
 if(!admin||!sb)return;const host=$('#teacher-exams');host.textContent='Cargando…';
 const {data,error}=await sb.from('glp_exams').select('id,title,status,cohort_id,created_at,passing_score').order('created_at',{ascending:false});
 if(error){host.textContent='No se pudieron cargar evaluaciones: '+error.message;return}
 if(!data?.length){host.innerHTML='<div class="empty">Todavía no creaste evaluaciones.</div>';return}
 const cohortIds=[...new Set(data.map(x=>x.cohort_id).filter(Boolean))];const {data:co}=cohortIds.length?await sb.from('glp_cohorts').select('id,name').in('id',cohortIds):{data:[]};const names=Object.fromEntries((co||[]).map(x=>[x.id,x.name]));
 host.innerHTML=data.map(x=>`<div class="admin-item"><b>${escapeHTML(x.title)}</b><small>${escapeHTML(names[x.cohort_id]||'Comisión')} · ${escapeHTML(x.status)} · Aprobación ${x.passing_score||70}/100</small><button class="btn secondary" data-exam-status="${x.id}" data-status="${x.status}">${x.status==='published'?'Cerrar evaluación':x.status==='closed'?'Reabrir':'Publicar'}</button><button class="btn primary" data-exam-submissions="${x.id}" data-title="${escapeHTML(x.title)}">Ver entregas</button></div>`).join('');
 $$('[data-exam-status]').forEach(b=>b.addEventListener('click',()=>changeExamStatus(b.dataset.examStatus,b.dataset.status)));
 $$('[data-exam-submissions]').forEach(b=>b.addEventListener('click',()=>loadSubmissions(b.dataset.examSubmissions,b.dataset.title)));
}
async function changeExamStatus(id,status){
 const next=status==='draft'?'published':status==='published'?'closed':'published';
 if(next==='published'&&!confirm('¿Publicar esta evaluación para los alumnos de la comisión?'))return;
 const {data:links,error:le}=await sb.from('glp_exam_cases').select('case_id').eq('exam_id',id);if(le){alert(le.message);return}if(next==='published'&&links?.length!==5){alert('La evaluación debe tener exactamente cinco pedidos.');return}
 const {error}=await sb.from('glp_exams').update({status:next}).eq('id',id);if(error){alert('No se pudo cambiar el estado: '+error.message);return}await loadTeacherExams();
}
async function loadSubmissions(examId,title){
 const panel=$('#submission-panel'),host=$('#submission-list');panel.hidden=false;$('#submission-panel-title').textContent='Entregas · '+title;host.textContent='Cargando entregas…';
 const {data,error}=await sb.from('glp_submissions').select('id,student_id,attempt_no,status,submitted_at,total_score,passed,teacher_feedback').eq('exam_id',examId).order('submitted_at',{ascending:false});
 if(error){host.textContent='No se pudieron cargar las entregas: '+error.message;return}
 if(!data?.length){host.innerHTML='<div class="empty">Todavía no hay alumnos que hayan entregado esta evaluación.</div>';return}
 const uids=[...new Set(data.map(x=>x.student_id))];const {data:profiles}=await sb.from('glp_profiles').select('user_id,display_name,email').in('user_id',uids);const map=Object.fromEntries((profiles||[]).map(x=>[x.user_id,x]));
 host.innerHTML=data.map(s=>{const p=map[s.student_id]||{};return `<div class="admin-item"><b>${escapeHTML(p.display_name||p.email||'Alumno')}</b><small>${escapeHTML(p.email||s.student_id)} · Intento ${s.attempt_no} · ${escapeHTML(s.status)} · ${new Date(s.submitted_at).toLocaleString('es-AR')}</small>${s.total_score!==null?`<small>Nota: ${s.total_score}/100 · ${s.passed?'Aprobado':'No aprobado'}</small>`:''}<button class="btn primary" data-grade-submission="${s.id}" data-student="${escapeHTML(p.display_name||p.email||'Alumno')}" data-exam="${examId}">${s.status==='graded'?'Ver corrección':'Corregir / revisar'}</button></div>`}).join('');
 $$('[data-grade-submission]').forEach(b=>b.addEventListener('click',()=>openGrading(b.dataset.gradeSubmission,b.dataset.student,examId)));
}
async function openGrading(submissionId,student,examId){
 const panel=$('#grading-panel'),host=$('#grading-content');panel.hidden=false;$('#grading-title').textContent='Corrección · '+student;host.textContent='Cargando respuestas…';
 const {data:sub,error:se}=await sb.from('glp_submissions').select('*').eq('id',submissionId).single();if(se){host.textContent=se.message;return}
 const {data:answers,error}=await sb.from('glp_submission_answers').select('id,case_id,answer,transcription').eq('submission_id',submissionId);if(error){host.textContent=error.message;return}
 const caseIds=answers.map(a=>a.case_id);const [{data:cases},{data:grades}]=await Promise.all([sb.from('glp_cases').select('id,title,code').in('id',caseIds),sb.from('glp_submission_grades').select('*').in('answer_id',answers.map(a=>a.id))]);
 const cMap=Object.fromEntries((cases||[]).map(c=>[c.id,c])),gMap=Object.fromEntries((grades||[]).map(g=>[g.answer_id,g]));
 host.innerHTML=`<p class="muted">Rúbrica total: reconocimiento 20 · áreas 15 · muestras/tubos 25 · preanalítica 20 · criterio/consulta 20. Se califica cada pedido y se promedia entre cinco.</p>`+answers.map((a,i)=>{const g=gMap[a.id]||{};return `<article class="grade-answer" data-answer-id="${a.id}"><h4>Pedido ${i+1}: ${escapeHTML(cMap[a.case_id]?.title||'Pedido')}</h4><pre>${escapeHTML(a.transcription||a.answer?.response||'')}</pre><div class="grade-grid"><label>Identificación /20<input type="number" min="0" max="20" step="0.5" class="g-rec" value="${g.recognition??0}"></label><label>Áreas /15<input type="number" min="0" max="15" step="0.5" class="g-area" value="${g.areas??0}"></label><label>Muestras y tubos /25<input type="number" min="0" max="25" step="0.5" class="g-sample" value="${g.sample_tubes??0}"></label><label>Preanalítica /20<input type="number" min="0" max="20" step="0.5" class="g-pre" value="${g.preanalytics??0}"></label><label>Criterio y consulta /20<input type="number" min="0" max="20" step="0.5" class="g-judge" value="${g.judgement??0}"></label></div><label>Observación para este pedido<textarea class="g-feedback" rows="2">${escapeHTML(g.feedback||'')}</textarea></label></article>`}).join('')+`<label>Devolución general al alumno<textarea id="overall-feedback" rows="4">${escapeHTML(sub.teacher_feedback||'')}</textarea></label><p id="grade-total" class="result">Puntaje promedio: — / 100</p><div class="actions"><button class="btn secondary" id="save-grade-draft">Guardar corrección</button><button class="btn secondary" id="return-grade">Devolver para corregir</button><button class="btn primary" id="publish-grade">Publicar nota final</button></div><p id="grade-message" class="message"></p>`;
 const calculate=()=>{let sums=[0,0,0,0,0],valid=true;$$('.grade-answer').forEach(card=>{const vals=['.g-rec','.g-area','.g-sample','.g-pre','.g-judge'].map(s=>Number(card.querySelector(s).value));const max=[20,15,25,20,20];vals.forEach((v,i)=>{if(!Number.isFinite(v)||v<0||v>max[i])valid=false;sums[i]+=v});});const total=sums.reduce((a,b)=>a+b,0)/5;$('#grade-total').textContent=`Puntaje promedio: ${valid?total.toFixed(1):'Revisar valores'} / 100 · ${valid?(total>=70?'Aprobación estimada':'No alcanza 70 puntos'):''}`;return {valid,total};};
 $$('.grade-answer input').forEach(x=>x.addEventListener('input',calculate));calculate();
 async function saveGrade(finalAction){const calc=calculate();if(!calc.valid){msg('#grade-message','Hay puntajes fuera de los máximos permitidos.');return}
  for(const card of $$('.grade-answer')){const vals={recognition:Number(card.querySelector('.g-rec').value),areas:Number(card.querySelector('.g-area').value),sample_tubes:Number(card.querySelector('.g-sample').value),preanalytics:Number(card.querySelector('.g-pre').value),judgement:Number(card.querySelector('.g-judge').value),feedback:card.querySelector('.g-feedback').value,grader_id:(await sb.auth.getUser()).data.user.id,answer_id:card.dataset.answerId};const {error:ge}=await sb.from('glp_submission_grades').upsert(vals,{onConflict:'answer_id'});if(ge){msg('#grade-message','Error al guardar rúbrica: '+ge.message);return}}
  const upd={teacher_feedback:$('#overall-feedback').value.trim()};if(finalAction==='return'){upd.status='returned';upd.returned_at=new Date().toISOString();}if(finalAction==='publish'){upd.status='graded';upd.graded_at=new Date().toISOString();upd.total_score=Number(calc.total.toFixed(2));upd.passed=calc.total>=70;}
  if(finalAction){const {error:ue}=await sb.from('glp_submissions').update(upd).eq('id',submissionId);if(ue){msg('#grade-message','La rúbrica se guardó, pero no se pudo actualizar el estado: '+ue.message);return}}
  msg('#grade-message',finalAction==='return'?'Devolución enviada. El alumno podrá corregir y reenviar.':finalAction==='publish'?'Calificación publicada: '+calc.total.toFixed(1)+'/100. '+(calc.total>=70?'Aprobado.':'No aprobado.'):'Corrección guardada como borrador.');
  if(finalAction)await loadSubmissions(examId,'');
 }
 $('#save-grade-draft').addEventListener('click',()=>saveGrade(null));$('#return-grade').addEventListener('click',()=>saveGrade('return'));$('#publish-grade').addEventListener('click',()=>saveGrade('publish'));
 panel.scrollIntoView({behavior:'smooth',block:'start'});
}
$('#close-submissions').addEventListener('click',()=>$('#submission-panel').hidden=true);$('#close-grading').addEventListener('click',()=>$('#grading-panel').hidden=true);

if(sb)sb.auth.onAuthStateChange(()=>{refreshAdmin();refreshAccount()});
refreshAdmin();refreshAccount();


// --- Generador de pedidos aleatorios 1.8.0 ---
let determinationCatalog=[];
async function loadDeterminationCatalog(){
 try{const r=await fetch('./determinaciones.json');if(!r.ok)throw new Error('HTTP '+r.status);const rows=await r.json();determinationCatalog=Array.isArray(rows)?rows.filter(x=>x&&x["Determinación"]):[];renderPracticeCatalog();}
 catch(e){console.error('No se pudo cargar el catálogo',e);determinationCatalog=[];}
}

function renderPracticeCatalog(){
 const host=$('#practice-catalog-results'),input=$('#practice-catalog-search');if(!host||!input)return;
 const term=norm(input.value).trim();
 if(term.length<2){host.innerHTML=`<small>Catálogo disponible: ${determinationCatalog.length.toLocaleString('es-AR')} determinaciones. Escribí al menos dos caracteres.</small>`;return}
 const hits=determinationCatalog.filter(r=>norm([r['Determinación'],r['Sinónimos'],r['Grupo'],r['Sector'],r['NBU']].join(' ')).includes(term)).slice(0,8);
 if(!hits.length){host.innerHTML='<small>No se encontraron coincidencias.</small>';return}
 host.innerHTML=hits.map((r,i)=>`<div class="catalog-hit"><span><b>${escapeHTML(r['Determinación'])}</b><small>${escapeHTML(r['Grupo']||r['Sector']||'')} · ${escapeHTML(r['Muestra']||'Muestra no especificada')} · ${escapeHTML(r['Tubo']||'Tubo no especificado')}</small></span><button type="button" class="btn secondary" data-practice-add="${i}">Agregar</button></div>`).join('');
 host.querySelectorAll('[data-practice-add]').forEach((b,i)=>b.addEventListener('click',()=>{const r=hits[i];addDeterminationRow({test:r['Determinación'],area:r['Sector']||r['Grupo'],sample:r['Muestra'],tube:[r['Tubo'],r['Aditivo']].filter(Boolean).join(' · ')});}));
}
$('#practice-catalog-search').addEventListener('input',renderPracticeCatalog);

function randomUniqueRows(count){
 const pool=[...determinationCatalog];
 for(let i=pool.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]]}
 return pool.slice(0,count);
}
function orderDisplayRow(r,i){
 return {numero:i+1,determinacion:r["Determinación"]||"",grupo:r["Grupo"]||"",sector:r["Sector"]||"",muestra:r["Muestra"]||"",tubo:r["Tubo"]||"",aditivo:r["Aditivo"]||""};
}
async function loadGeneratedOrders(){
 if(!admin||!sb)return;
 const host=$('#generated-orders-list');host.textContent='Cargando…';
 const {data,error}=await sb.rpc('glp_admin_list_generated_orders');
 if(error){host.textContent='No se pudieron cargar los pedidos. Aplicá migration_1_7.sql en Supabase. '+error.message;return}
 if(!data?.length){host.innerHTML='<div class="empty">Todavía no generaste pedidos.</div>';return}
 host.innerHTML=data.map(o=>{
  const url=`${location.origin}${location.pathname}?pedido=${encodeURIComponent(o.token)}`;
  return `<article class="admin-item"><b>${escapeHTML(o.title)}</b><small>${escapeHTML(o.difficulty)} · ${o.item_count} determinaciones · ${o.submission_count} entregas · ${o.status==='active'?'Activo':'Cerrado'}</small><small>Token: <code>${escapeHTML(o.token)}</code></small><div class="actions"><button class="btn secondary" data-copy-generated="${escapeHTML(url)}">Copiar enlace</button><button class="btn secondary" data-copy-token="${escapeHTML(o.token)}">Copiar token</button><button class="btn secondary" data-toggle-generated="${o.id}" data-next="${o.status==='active'?'closed':'active'}">${o.status==='active'?'Cerrar':'Reabrir'}</button></div></article>`;
 }).join('');
 $$('[data-copy-generated]').forEach(b=>b.addEventListener('click',()=>navigator.clipboard.writeText(b.dataset.copyGenerated).then(()=>alert('Enlace copiado')).catch(()=>prompt('Copiá el enlace',b.dataset.copyGenerated))));
 $$('[data-copy-token]').forEach(b=>b.addEventListener('click',()=>navigator.clipboard.writeText(b.dataset.copyToken).then(()=>alert('Token copiado')).catch(()=>prompt('Copiá el token',b.dataset.copyToken))));
 $$('[data-toggle-generated]').forEach(b=>b.addEventListener('click',async()=>{const {error}=await sb.rpc('glp_admin_set_generated_order_status',{p_id:b.dataset.toggleGenerated,p_status:b.dataset.next});if(error)alert(error.message);else loadGeneratedOrders()}));
}
$('#generated-order-form').addEventListener('submit',async e=>{
 e.preventDefault();if(!sb||!admin){msg('#generated-order-message','Necesitás iniciar sesión como docente.');return}
 if(!determinationCatalog.length){msg('#generated-order-message','No se pudo cargar determinaciones.json. Verificá que esté en la raíz del sitio.');return}
 const count=Number($('#generated-count').value),rows=randomUniqueRows(count);
 if(rows.length!==count){msg('#generated-order-message','La base no tiene suficientes determinaciones.');return}
 const orderData=rows.map(orderDisplayRow);
 const answerKey=rows.map(r=>({
  determinacion:r["Determinación"]||"",area:r["Sector"]||r["Grupo"]||"",
  muestra:r["Muestra"]||"",tubo:r["Tubo"]||"",aditivo:r["Aditivo"]||"",
  ayuno:r["Ayuno"]||"",toma:r["Toma"]||"",procesamiento:r["Procesamiento"]||"",
  condiciones:r["Condiciones especiales"]||"",observaciones:r["Observaciones"]||""
 }));
 const expiry=$('#generated-expiry').value?new Date($('#generated-expiry').value).toISOString():null;
 const btn=$('#generate-order-button');btn.disabled=true;btn.textContent='Generando…';msg('#generated-order-message','');
 const {data,error}=await sb.rpc('glp_create_generated_order',{
  p_title:$('#generated-title').value.trim()||'Pedido simulado',
  p_instructions:$('#generated-instructions').value.trim(),
  p_difficulty:$('#generated-difficulty').value,
  p_order_data:orderData,p_answer_key:answerKey,p_expires_at:expiry
 });
 btn.disabled=false;btn.textContent='Generar pedido y enlace';
 if(error){msg('#generated-order-message','No se pudo generar: '+error.message+' · Si la función no existe, ejecutá migration_1_7.sql en Supabase.');return}
 const url=`${location.origin}${location.pathname}?pedido=${encodeURIComponent(data.token)}`;
 $('#generated-link-result').hidden=false;
 $('#generated-link-result').innerHTML=`<h3>Pedido generado correctamente</h3><p><b>Enlace para el alumno</b></p><input readonly value="${escapeHTML(url)}" id="new-generated-url"><p><b>Token de acceso</b></p><input readonly value="${escapeHTML(data.token)}" id="new-generated-token"><div class="actions"><button class="btn primary" type="button" id="copy-new-link">Copiar enlace</button><button class="btn secondary" type="button" id="copy-new-token">Copiar token</button><a class="btn secondary" target="_blank" rel="noopener" href="${escapeHTML(url)}">Abrir como alumno</a></div><p class="muted">${data.item_count} determinaciones · ${escapeHTML($('#generated-difficulty').value)}</p>`;
 $('#copy-new-link').addEventListener('click',()=>navigator.clipboard.writeText(url).then(()=>msg('#generated-order-message','Enlace copiado.')));
 $('#copy-new-token').addEventListener('click',()=>navigator.clipboard.writeText(data.token).then(()=>msg('#generated-order-message','Token copiado.')));
 msg('#generated-order-message','Pedido creado. Compartí el enlace o el token con tus alumnos.');
 await loadGeneratedOrders();
});
$('#reload-generated-orders').addEventListener('click',loadGeneratedOrders);
async function openGeneratedOrder(token){
 if(!sb){$('#generated-student-content').textContent='No se pudo conectar con el servidor.';return}
 go('pedido-generado');
 const {data,error}=await sb.rpc('glp_get_generated_order',{p_token:token});
 if(error){$('#generated-student-content').textContent='No se pudo abrir el pedido: '+error.message;$('#generated-student-meta').textContent='Enlace no disponible';return}
 $('#generated-student-title').textContent=data.title;
 $('#generated-student-instructions').textContent=data.instructions||'Completá la resolución de este pedido simulado.';
 $('#generated-student-meta').textContent=`${data.item_count} determinaciones · ${data.difficulty}`;
 const rows=data.order_data||[];
 $('#generated-student-content').innerHTML=`<form id="generated-student-form"><label>Tu nombre (opcional)<input id="generated-student-name" maxlength="100" placeholder="Nombre y apellido"></label><div class="notice">Pedido simulado para entrenamiento. No representa una orden médica real.</div><div class="generated-paper"><h3>ORDEN DE LABORATORIO</h3><p>Paciente: ____________________　Fecha: ____ / ____ / ______</p>${rows.map(r=>`<div class="generated-line"><b>${r.numero}.</b> ${escapeHTML(r.determinacion)}</div>`).join('')}</div><h3>Resolución del alumno</h3>${rows.map((r,i)=>`<fieldset class="generated-answer"><legend>Determinación ${i+1}: ${escapeHTML(r.determinacion)}</legend><div class="two-col"><label>Área<input class="gs-area" data-i="${i}" placeholder="Área del laboratorio"></label><label>Muestra<input class="gs-sample" data-i="${i}" placeholder="Muestra biológica"></label><label>Tubo / aditivo<input class="gs-tube" data-i="${i}" placeholder="Tubo y aditivo"></label><label>Preparación / ayuno<input class="gs-fasting" data-i="${i}" placeholder="Indicaciones al paciente"></label></div><label>Observaciones / dudas<textarea class="gs-notes" data-i="${i}" rows="2" placeholder="Condiciones preanalíticas, inconsistencias o consultas"></textarea></label></fieldset>`).join('')}<button class="btn primary full" type="submit" id="submit-generated-response">Enviar resolución</button><p id="generated-submit-message" class="message"></p></form>`;
 $('#generated-student-form').addEventListener('submit',async e=>{
  e.preventDefault();const response=rows.map((r,i)=>({determinacion:r.determinacion,area:$(`.gs-area[data-i="${i}"]`).value.trim(),muestra:$(`.gs-sample[data-i="${i}"]`).value.trim(),tubo:$(`.gs-tube[data-i="${i}"]`).value.trim(),preparacion:$(`.gs-fasting[data-i="${i}"]`).value.trim(),observaciones:$(`.gs-notes[data-i="${i}"]`).value.trim()}));
  const b=$('#submit-generated-response');b.disabled=true;b.textContent='Enviando…';
  const {data:result,error:submitError}=await sb.rpc('glp_submit_generated_order',{p_token:token,p_student_name:$('#generated-student-name').value.trim()||'Alumno',p_response:response});
  b.disabled=false;b.textContent='Enviar resolución';
  if(submitError){msg('#generated-submit-message','No se pudo enviar: '+submitError.message);return}
  $('#generated-student-content').innerHTML=`<div class="result ${result.score>=70?'':'bad'}"><h3>Entrega registrada</h3><p>Reconocimiento de determinaciones: <b>${result.score}%</b></p><p>Coincidencias: ${result.matched?.length?result.matched.map(escapeHTML).join(', '):'Ninguna'}</p><p>Para revisar: ${result.missing?.length?result.missing.map(escapeHTML).join(', '):'Ninguna'}</p><p>${escapeHTML(result.message)}</p><p>La devolución final y la evaluación de los campos técnicos quedan sujetas a revisión docente.</p></div>`;
 });
}
async function initGeneratedOrderMode(){
 await loadDeterminationCatalog();
 const token=new URLSearchParams(location.search).get('pedido');
 if(token)await openGeneratedOrder(token);
}
$('#generator-login-note').hidden=admin;
$('#generator-workspace').hidden=!admin;
const oldRefreshAdmin=refreshAdmin;
refreshAdmin=async function(){await oldRefreshAdmin();$('#generator-login-note').hidden=admin;$('#generator-workspace').hidden=!admin;if(admin)loadGeneratedOrders()};
initGeneratedOrderMode();
