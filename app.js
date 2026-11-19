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
// Excluir del uso didáctico las entradas NBU incompletas: se incorporarán cuando tengan ficha preanalítica completa.
function isEligibleDetermination(r){
 if(!r||!r['Determinación'])return false;
 const group=norm(r['Grupo']||'');const sector=norm(r['Sector']||'');const notes=norm(r['Observaciones']||'');
 const nbu=norm(r['NBU']||'');
 return group!=='nomenclador nbu' && sector!=='nomenclador nbu' && !notes.includes('practica incorporada desde el nomenclador bioquimico unico') && !nbu.includes('consultar nbu');
}
async function loadDeterminationCatalog(){
 try{const r=await fetch('./determinaciones.json');if(!r.ok)throw new Error('HTTP '+r.status);const rows=await r.json();determinationCatalog=Array.isArray(rows)?rows.filter(isEligibleDetermination):[];renderPracticeCatalog();}
 catch(e){console.error('No se pudo cargar el catálogo',e);determinationCatalog=[];}
}

function renderPracticeCatalog(){
 const host=$('#practice-catalog-results'),input=$('#practice-catalog-search');if(!host||!input)return;
 const term=norm(input.value).trim();
 if(term.length<2){host.innerHTML=`<small>Catálogo disponible: ${determinationCatalog.length.toLocaleString('es-AR')} determinaciones completas. Las entradas NBU incompletas están excluidas. Escribí al menos dos caracteres.</small>`;return}
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
function makeClientKey(sessionToken,studentName){
 const nameKey=norm(studentName).replace(/[^a-z0-9]+/g,'_').slice(0,60)||'alumno';
 const keyName='glp_random_assignment_'+sessionToken+'_'+nameKey;
 let key=localStorage.getItem(keyName);
 if(!key){key=(crypto.randomUUID?crypto.randomUUID():`${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`);localStorage.setItem(keyName,key)}
 return key;
}
async function exportAllGeneratedGrades(){
 const {data,error}=await sb.rpc('glp_admin_export_all_generated_grades');
 if(error){alert('No se pudieron exportar las calificaciones: '+error.message+' Aplicá migration_1_12.sql.');return}
 const rows=data||[];
 if(!rows.length){alert('Todavía no hay entregas para exportar.');return}
 const fields=['Actividad','Modalidad','Alumno','Fecha de entrega','Estado de corrección','Nota del pedido (0-100)','Nota presencial (0-100)','Código de seguimiento','Devolución docente','Orden de llenado Vacutainer'];
 const quote=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
 const csv='\ufeff'+[fields.map(quote).join(';'),...rows.map(r=>[r.activity_title,r.order_type,r.student_name,r.submitted_at?new Date(r.submitted_at).toLocaleString('es-AR'):'',r.review_status==='graded'?'Corregida':'Pendiente',r.order_grade,r.practical_grade,r.access_code,r.teacher_feedback,r.vacutainer_order].map(quote).join(';'))].join('\r\n');
 const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='guialab_registro_general_calificaciones.csv';document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
}
$('#export-all-generated-grades')?.addEventListener('click',exportAllGeneratedGrades);

let academicRegisterRows=[];
async function loadAcademicRegister(){
 const host=$('#academic-register-list');if(!host||!admin)return;
 host.textContent='Cargando registro académico…';
 const {data,error}=await sb.rpc('glp_admin_export_all_generated_grades');
 if(error){host.textContent='No se pudo cargar el registro: '+error.message;return}
 academicRegisterRows=data||[];renderAcademicRegister();
}
function renderAcademicRegister(){
 const host=$('#academic-register-list');if(!host)return;
 const term=norm($('#academic-register-search')?.value||'');const status=$('#academic-register-status')?.value||'';
 const filtered=academicRegisterRows.filter(r=>{
  const matches=!term||norm([r.student_name,r.activity_title,r.order_type,r.access_code].join(' ')).includes(term);
  const st=r.review_status==='graded'?'graded':'pending';return matches&&(!status||st===status);
 });
 if(!filtered.length){host.innerHTML='<p class="muted">No hay resultados para esos filtros.</p>';return}
 host.innerHTML=`<div class="table-scroll"><table class="academic-table"><thead><tr><th>Alumno</th><th>Actividad</th><th>Entrega</th><th>Estado</th><th>Virtual</th><th>Presencial</th></tr></thead><tbody>${filtered.map(r=>`<tr><td>${escapeHTML(r.student_name||'—')}</td><td>${escapeHTML(r.activity_title||'—')}</td><td>${r.submitted_at?new Date(r.submitted_at).toLocaleDateString('es-AR'):'—'}</td><td>${r.review_status==='graded'?'Corregida':'Pendiente'}</td><td>${r.order_grade??'—'}</td><td>${r.practical_grade??'—'}</td></tr>`).join('')}</tbody></table></div><small>${filtered.length} de ${academicRegisterRows.length} entregas</small>`;
}
$('#academic-register-search')?.addEventListener('input',renderAcademicRegister);
$('#academic-register-status')?.addEventListener('change',renderAcademicRegister);
$('#reload-academic-register')?.addEventListener('click',loadAcademicRegister);
$('#print-academic-register')?.addEventListener('click',()=>{
 const term=norm($('#academic-register-search')?.value||'');const status=$('#academic-register-status')?.value||'';
 const rows=academicRegisterRows.filter(r=>(!term||norm([r.student_name,r.activity_title,r.order_type,r.access_code].join(' ')).includes(term))&&(!status||(r.review_status==='graded'?'graded':'pending')===status));
 const esc=s=>String(s??'—').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const w=window.open('','_blank');if(!w){alert('Permití las ventanas emergentes para imprimir el acta.');return}
 w.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Acta de calificaciones · GuiaLab</title><style>body{font:12px Arial,sans-serif;margin:24px;color:#111}h1{font-size:20px}p{color:#555}table{width:100%;border-collapse:collapse;margin-top:18px}th,td{border:1px solid #aaa;padding:7px;text-align:left}th{background:#eee}.sign{margin-top:55px;display:flex;justify-content:space-around}@media print{button{display:none}}</style></head><body><h1>Registro general de calificaciones · GuiaLab Pedidos</h1><p>Fecha de emisión: ${new Date().toLocaleString('es-AR')}</p><table><thead><tr><th>Alumno</th><th>Actividad</th><th>Fecha</th><th>Estado</th><th>Nota virtual</th><th>Nota presencial</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(r.student_name)}</td><td>${esc(r.activity_title)}</td><td>${r.submitted_at?new Date(r.submitted_at).toLocaleDateString('es-AR'):'—'}</td><td>${r.review_status==='graded'?'Corregida':'Pendiente'}</td><td>${esc(r.order_grade)}</td><td>${esc(r.practical_grade)}</td></tr>`).join('')}</tbody></table><div class="sign"><span>Firma docente: ____________________</span><span>Fecha: ____________________</span></div><script>window.onload=()=>window.print()<\/script></body></html>`);w.document.close();
});


async function loadGeneratedOrders(){
 if(!admin||!sb)return;
 const host=$('#generated-orders-list');host.textContent='Cargando…';
 const sessionsHost=$('#random-sessions-list');
 const {data:sessions,error:sessionError}=await sb.rpc('glp_admin_list_random_sessions');
 if(sessionsHost){if(sessionError)sessionsHost.innerHTML=`<small>No se pudieron cargar las comisiones: ${escapeHTML(sessionError.message)}</small>`;else sessionsHost.innerHTML=(sessions||[]).length?sessions.map(x=>`<article class="admin-item"><b>${escapeHTML(x.title)}</b><small>${x.assignment_count} pedidos individuales · ${escapeHTML(x.difficulty)} · ${x.status==='active'?'Enlace activo':'Cerrado'}</small><small>Enlace: <code>?grupo=${escapeHTML(x.token)}</code></small><div class="actions"><button type="button" class="btn secondary" data-copy-session="${escapeHTML(x.token)}">Copiar enlace</button><button type="button" class="btn secondary" data-export-session="${x.id}" data-session-title="${escapeHTML(x.title)}">Exportar alumnos y códigos</button><button type="button" class="btn secondary" data-toggle-session="${x.id}" data-next="${x.status==='active'?'closed':'active'}">${x.status==='active'?'Cerrar enlace':'Reabrir enlace'}</button><button type="button" class="btn secondary" data-delete-session="${x.id}" data-session-title="${escapeHTML(x.title)}">Eliminar comisión</button></div></article>`).join(''):'<small>Todavía no creaste enlaces de comisión.</small>';sessionsHost.querySelectorAll('[data-copy-session]').forEach(b=>{const url=`${location.origin}${location.pathname}?grupo=${encodeURIComponent(b.dataset.copySession)}`;b.addEventListener('click',()=>navigator.clipboard.writeText(url).then(()=>alert('Enlace copiado')).catch(()=>prompt('Copiá el enlace',url)))});sessionsHost.querySelectorAll('[data-export-session]').forEach(b=>b.addEventListener('click',()=>exportRandomSession(b.dataset.exportSession,b.dataset.sessionTitle)));sessionsHost.querySelectorAll('[data-toggle-session]').forEach(b=>b.addEventListener('click',async()=>{const {error}=await sb.rpc('glp_admin_set_random_session_status',{p_id:b.dataset.toggleSession,p_status:b.dataset.next});if(error)alert(error.message);else loadGeneratedOrders()}));sessionsHost.querySelectorAll('[data-delete-session]').forEach(b=>b.addEventListener('click',async()=>{if(!confirm(`¿Eliminar definitivamente la comisión «${b.dataset.sessionTitle}»? Se borrarán también todos los pedidos individuales y sus entregas, respuestas, correcciones y códigos de seguimiento. Esta acción no se puede deshacer.`))return;const {error}=await sb.rpc('glp_admin_delete_random_session',{p_id:b.dataset.deleteSession});if(error){alert('No se pudo eliminar la comisión: '+error.message);return}alert('Comisión y datos asociados eliminados.');loadGeneratedOrders()}));}
 const {data,error}=await sb.rpc('glp_admin_list_generated_orders');
 if(error){host.textContent='No se pudieron cargar los pedidos. Aplicá migration_1_7.sql en Supabase. '+error.message;return}
 if(!data?.length){host.innerHTML='<div class="empty">Todavía no generaste pedidos.</div>';return}
 host.innerHTML=data.map(o=>{
  const url=`${location.origin}${location.pathname}?pedido=${encodeURIComponent(o.token)}`;
  return `<article class="admin-item"><b>${escapeHTML(o.title)}</b><small>${o.session_id?'Pedido individual · '+escapeHTML(o.assigned_student_name||'Alumno'): 'Pedido compartido'} · ${escapeHTML(o.difficulty)} · ${o.item_count} determinaciones · ${o.submission_count} entregas · ${o.status==='active'?'Activo':'Cerrado'}</small><small>Token: <code>${escapeHTML(o.token)}</code></small><div class="actions"><button class="btn primary" data-review-generated="${o.id}" data-title="${escapeHTML(o.title)}">Ver entregas (${o.submission_count})</button><button class="btn secondary" data-copy-generated="${escapeHTML(url)}">Copiar enlace</button><button class="btn secondary" data-copy-token="${escapeHTML(o.token)}">Copiar token</button><button class="btn secondary" data-toggle-generated="${o.id}" data-next="${o.status==='active'?'closed':'active'}">${o.status==='active'?'Cerrar':'Reabrir'}</button><button class="btn secondary" data-delete-generated="${o.id}" data-order-title="${escapeHTML(o.title)}">Eliminar pedido</button></div><div id="generated-review-${o.id}" class="generated-review" hidden></div></article>`;
 }).join('');
 $$('[data-review-generated]').forEach(b=>b.addEventListener('click',()=>loadGeneratedSubmissions(b.dataset.reviewGenerated,b.dataset.title)));
 $$('[data-copy-generated]').forEach(b=>b.addEventListener('click',()=>navigator.clipboard.writeText(b.dataset.copyGenerated).then(()=>alert('Enlace copiado')).catch(()=>prompt('Copiá el enlace',b.dataset.copyGenerated))));
 $$('[data-copy-token]').forEach(b=>b.addEventListener('click',()=>navigator.clipboard.writeText(b.dataset.copyToken).then(()=>alert('Token copiado')).catch(()=>prompt('Copiá el token',b.dataset.copyToken))));
 $$('[data-toggle-generated]').forEach(b=>b.addEventListener('click',async()=>{const {error}=await sb.rpc('glp_admin_set_generated_order_status',{p_id:b.dataset.toggleGenerated,p_status:b.dataset.next});if(error)alert(error.message);else loadGeneratedOrders()}));
 $$('[data-delete-generated]').forEach(b=>b.addEventListener('click',async()=>{if(!confirm(`¿Eliminar definitivamente «${b.dataset.orderTitle}»? También se borrarán todas sus entregas, respuestas, correcciones y códigos de seguimiento. Esta acción no se puede deshacer.`))return;const {error}=await sb.rpc('glp_admin_delete_generated_order',{p_id:b.dataset.deleteGenerated});if(error){alert('No se pudo eliminar el pedido: '+error.message);return}alert('Pedido y entregas asociadas eliminados.');loadGeneratedOrders()}));
}
async function exportRandomSession(sessionId,title){
 const {data,error}=await sb.rpc('glp_admin_export_random_session',{p_session_id:sessionId});
 if(error){alert('No se pudo exportar la lista: '+error.message);return}
 const rows=data||[],fields=['Alumno','Codigo de seguimiento','Estado','Calificacion','Fecha de entrega'];
 const quote=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
 const csv='\ufeff'+[fields.map(quote).join(';'),...rows.map(r=>[r.student_name,r.access_code,r.review_status==='graded'?'Corregida':r.submitted_at?'Pendiente de correccion':'Sin entregar',r.teacher_grade,r.submitted_at?new Date(r.submitted_at).toLocaleString('es-AR'):''].map(quote).join(';'))].join('\r\n');
 const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=String(title||'comision').replace(/[^a-z0-9_-]+/gi,'_')+'_alumnos_codigos.csv';document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
}
async function loadGeneratedSubmissions(orderId,title){
 const host=$(`#generated-review-${orderId}`);host.hidden=false;host.innerHTML='<p>Cargando entregas…</p>';
 const {data,error}=await sb.rpc('glp_admin_get_generated_submissions',{p_order_id:orderId});
 if(error){host.innerHTML=`<p class="message">No se pudieron cargar las entregas: ${escapeHTML(error.message)}. Aplicá migration_1_8.sql.</p>`;return}
 if(!data?.length){host.innerHTML='<p class="muted">Todavía no hay alumnos que hayan entregado esta actividad.</p>';return}
 host.innerHTML=`<h3>Entregas · ${escapeHTML(title)}</h3>`+data.map((sub)=>{
  const response=Array.isArray(sub.response)?sub.response:[];const expected=Array.isArray(sub.answer_key)?sub.answer_key:[];
  const reviewed=sub.review_status==='graded';
  return `<section class="generated-submission" data-submission="${sub.id}"><div class="admin-toolbar"><div><b>${escapeHTML(sub.student_name)}</b><small>${new Date(sub.submitted_at).toLocaleString('es-AR')} · ${reviewed?'Corregida':'Pendiente de corrección'}${reviewed&&sub.teacher_grade!==null?' · Nota '+sub.teacher_grade+'/100':''}</small>${sub.access_code?`<small>Código del alumno: <code>${escapeHTML(sub.access_code)}</code> <button type="button" class="btn secondary" data-copy-access="${escapeHTML(sub.access_code)}">Copiar código</button></small>`:''}</div><button type="button" class="btn secondary" data-open-generated-submission="${sub.id}">${reviewed?'Ver / editar corrección':'Corregir entrega'}</button></div><div id="generated-grade-${sub.id}" hidden>${response[0]?.orden_llenado_vacutainer?`<div class="notice"><b>Orden de llenado Vacutainer informado por el alumno</b><p>${escapeHTML(response[0].orden_llenado_vacutainer)}</p></div>`:''}<div class="generated-grade-items">${response.map((r,i)=>{const k=expected[i]||{};return `<article class="generated-grade-item"><h4>${i+1}. ${escapeHTML(r.determinacion||k.determinacion||'Determinación')}</h4><div class="two-col"><div><b>Respuesta del alumno</b><p>Área: ${escapeHTML(r.area||'—')}<br>Muestra: ${escapeHTML(r.muestra||'—')}<br>Tubo/aditivo: ${escapeHTML(r.tubo||'—')}<br>Preparación: ${escapeHTML(r.preparacion||'—')}<br>Observaciones: ${escapeHTML(r.observaciones||'—')}</p></div><div><b>Clave esperada</b><p>Área: ${escapeHTML(k.area||'No cargada')}<br>Muestra: ${escapeHTML(k.muestra||'No cargada')}<br>Tubo: ${escapeHTML(k.tubo||'No cargado')}<br>Aditivo: ${escapeHTML(k.aditivo||'No cargado')}<br>Ayuno: ${escapeHTML(k.ayuno||'No especificado')}<br>Toma: ${escapeHTML(k.toma||'No especificada')}<br>Procesamiento: ${escapeHTML(k.procesamiento||'No especificado')}<br>Condiciones: ${escapeHTML(k.condiciones||'No especificadas')}</p></div></div><label>Puntaje de esta determinación (0 a 100)<input class="generated-item-score" type="number" min="0" max="100" step="1" value="${escapeHTML((sub.item_grades||{})[i]??'')}" data-index="${i}"></label></article>`}).join('')}</div><label>Devolución general<textarea class="generated-teacher-feedback" rows="3" placeholder="Fortalezas, errores y aspectos a mejorar…">${escapeHTML(sub.teacher_feedback||'')}</textarea></label><div class="form-card"><h4>Calificación presencial (opcional)</h4><p class="muted">Campo independiente de la nota del pedido. Completalo después de evaluar al alumno presencialmente.</p><label>Nota presencial (0 a 100)<input class="generated-practical-grade" type="number" min="0" max="100" step="0.5" placeholder="Dejar vacío si todavía no fue evaluado" value="${sub.practical_grade??''}"></label></div><div class="actions"><button type="button" class="btn primary" data-save-generated-grade="${sub.id}">Guardar y publicar corrección</button><button type="button" class="btn secondary" data-grade-history="${sub.id}">Ver historial de notas</button></div><div class="admin-list" id="generated-history-${sub.id}" hidden></div><p class="message" id="generated-grade-message-${sub.id}"></p></div></section>`;
 }).join('');
 host.querySelectorAll('[data-open-generated-submission]').forEach(b=>b.addEventListener('click',()=>{const panel=$(`#generated-grade-${b.dataset.openGeneratedSubmission}`);panel.hidden=!panel.hidden;}));
 host.querySelectorAll('[data-grade-history]').forEach(b=>b.addEventListener('click',async()=>{const panel=$(`#generated-history-${b.dataset.gradeHistory}`);panel.hidden=false;panel.textContent='Cargando historial…';const {data,error}=await sb.rpc('glp_admin_get_grade_history',{p_submission_id:b.dataset.gradeHistory});if(error){panel.textContent='No se pudo cargar el historial: '+error.message;return}panel.innerHTML=(data||[]).length?'<b>Historial de cambios</b>'+data.map(h=>`<article class="admin-item"><small>${new Date(h.changed_at).toLocaleString('es-AR')} · ${h.field_name==='pedido'?'Nota del pedido':'Nota presencial'}</small><small>Anterior: ${escapeHTML(JSON.stringify(h.old_value))}</small><small>Nuevo: ${escapeHTML(JSON.stringify(h.new_value))}</small></article>`).join(''):'Todavía no hay modificaciones registradas.';}));
 host.querySelectorAll('[data-copy-access]').forEach(b=>b.addEventListener('click',()=>navigator.clipboard.writeText(b.dataset.copyAccess).then(()=>alert('Código copiado')).catch(()=>prompt('Copiá el código',b.dataset.copyAccess))));
 host.querySelectorAll('[data-save-generated-grade]').forEach(b=>b.addEventListener('click',async()=>{
  const id=b.dataset.saveGeneratedGrade,card=b.closest('.generated-submission'),scores=[...card.querySelectorAll('.generated-item-score')].map(x=>x.value.trim()===''?null:Number(x.value));
  if(scores.some(x=>x===null||!Number.isFinite(x)||x<0||x>100)){msg(`#generated-grade-message-${id}`,'Completá un puntaje válido de 0 a 100 para cada determinación.');return}
  const feedback=card.querySelector('.generated-teacher-feedback').value.trim();b.disabled=true;b.textContent='Guardando…';
  const {data:result,error:saveError}=await sb.rpc('glp_admin_grade_generated_submission',{p_submission_id:id,p_item_grades:scores,p_teacher_feedback:feedback});
  if(saveError){b.disabled=false;b.textContent='Guardar y publicar corrección';msg(`#generated-grade-message-${id}`,'No se pudo guardar: '+saveError.message);return}
  const practicalRaw=card.querySelector('.generated-practical-grade').value.trim();
  const practical=practicalRaw===''?null:Number(practicalRaw);
  if(practical!==null&&(!Number.isFinite(practical)||practical<0||practical>100)){
   b.disabled=false;b.textContent='Guardar y publicar corrección';msg(`#generated-grade-message-${id}`,'La nota presencial debe estar entre 0 y 100. La corrección del pedido sí quedó guardada.');return;
  }
  const {error:practicalError}=await sb.rpc('glp_admin_set_practical_grade',{p_submission_id:id,p_practical_grade:practical});
  b.disabled=false;b.textContent='Guardar y publicar corrección';
  if(practicalError){msg(`#generated-grade-message-${id}`,'La corrección del pedido se guardó, pero no la nota presencial: '+practicalError.message);return}
  msg(`#generated-grade-message-${id}`,`Corrección publicada: ${result.teacher_grade}/100. Nota presencial: ${practical===null?'sin cargar':practical+'/100'}.`);await loadGeneratedSubmissions(orderId,title);
 }));
}

$('#generated-order-form').addEventListener('submit',async e=>{
 e.preventDefault();if(!sb||!admin){msg('#generated-order-message','Necesitás iniciar sesión como docente.');return}
 if(!determinationCatalog.length){msg('#generated-order-message','No se pudo cargar determinaciones.json. Verificá que esté en la raíz del sitio.');return}
 const count=Number($('#generated-count').value),rows=randomUniqueRows(count);
 if(rows.length!==count){msg('#generated-order-message','La base no tiene suficientes determinaciones.');return}
 const determinationNames=rows.map(r=>r['Determinación']);
 const expiry=$('#generated-expiry').value?new Date($('#generated-expiry').value).toISOString():null;
 const btn=$('#generate-order-button');btn.disabled=true;btn.textContent='Generando…';msg('#generated-order-message','');
 const {data,error}=await sb.rpc('glp_create_generated_order_from_catalog',{
  p_title:$('#generated-title').value.trim()||'Pedido simulado',
  p_instructions:$('#generated-instructions').value.trim(),
  p_difficulty:$('#generated-difficulty').value,
  p_determinations:determinationNames,p_expires_at:expiry
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
$('#generated-session-form').addEventListener('submit',async e=>{
 e.preventDefault();if(!sb||!admin){msg('#generated-session-message','Necesitás iniciar sesión como docente.');return}
 if(!determinationCatalog.length){msg('#generated-session-message','No se pudo cargar el catálogo de determinaciones.');return}
 const expiry=$('#session-expiry').value?new Date($('#session-expiry').value).toISOString():null;
 const btn=$('#generate-session-button');btn.disabled=true;btn.textContent='Creando enlace…';msg('#generated-session-message','');
 const {data,error}=await sb.rpc('glp_create_random_session',{p_title:$('#session-title').value.trim()||'Actividad individual',p_instructions:$('#session-instructions').value.trim(),p_difficulty:$('#session-difficulty').value,p_item_count:Number($('#session-count').value),p_expires_at:expiry});
 btn.disabled=false;btn.textContent='Crear enlace de pedidos individuales';
 if(error){msg('#generated-session-message','No se pudo crear el enlace: '+error.message+' · Ejecutá migration_1_10.sql en Supabase.');return}
 const url=`${location.origin}${location.pathname}?grupo=${encodeURIComponent(data.token)}`;
 $('#generated-session-result').hidden=false;
 $('#generated-session-result').innerHTML=`<h3>Enlace de comisión creado</h3><p>Compartí este mismo enlace con todos. Cada alumno recibirá un pedido aleatorio diferente al ingresar.</p><label>Enlace para toda la comisión<input readonly id="new-session-url" value="${escapeHTML(url)}"></label><div class="actions"><button type="button" class="btn primary" id="copy-session-url">Copiar enlace de comisión</button><a class="btn secondary" target="_blank" rel="noopener" href="${escapeHTML(url)}">Probar como alumno</a></div><p class="muted">${data.item_count} determinaciones por alumno · ${escapeHTML($('#session-difficulty').value)} · Vencimiento ${expiry?new Date(expiry).toLocaleString('es-AR'):'sin vencimiento'}</p>`;
 $('#copy-session-url').addEventListener('click',()=>navigator.clipboard.writeText(url).then(()=>msg('#generated-session-message','Enlace de comisión copiado.')).catch(()=>prompt('Copiá el enlace',url)));
 msg('#generated-session-message','Enlace creado. Cada alumno tendrá un pedido y una clave esperada propios.');await loadGeneratedOrders();
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
 $('#generated-student-content').innerHTML=`<form id="generated-student-form"><label>Tu nombre${data.assigned_student_name?'':' (opcional)'}<input id="generated-student-name" maxlength="100" placeholder="Nombre y apellido" value="${escapeHTML(data.assigned_student_name||'')}" ${data.assigned_student_name?'required':''} ${data.is_individual?'readonly':''}></label><div class="notice">Pedido simulado para entrenamiento. No representa una orden médica real.</div><div class="generated-paper"><h3>ORDEN DE LABORATORIO</h3><p>Paciente: ____________________　Fecha: ____ / ____ / ______</p>${rows.map(r=>`<div class="generated-line"><b>${r.numero}.</b> ${escapeHTML(r.determinacion)}</div>`).join('')}</div><h3>Resolución del alumno</h3>${rows.map((r,i)=>`<fieldset class="generated-answer"><legend>Determinación ${i+1}: ${escapeHTML(r.determinacion)}</legend><div class="two-col"><label>Área<input class="gs-area" data-i="${i}" placeholder="Área del laboratorio"></label><label>Muestra<input class="gs-sample" data-i="${i}" placeholder="Muestra biológica"></label><label>Tubo / aditivo<input class="gs-tube" data-i="${i}" placeholder="Tubo y aditivo"></label><label>Preparación / ayuno<input class="gs-fasting" data-i="${i}" placeholder="Indicaciones al paciente"></label></div><label>Observaciones / dudas<textarea class="gs-notes" data-i="${i}" rows="2" placeholder="Condiciones preanalíticas, inconsistencias o consultas"></textarea></label></fieldset>`).join('')}<fieldset class="generated-answer"><legend>Orden de llenado · Sistema Vacutainer</legend><label>Indicá la secuencia de tubos según el orden de extracción<input id="gs-vacutainer-order" placeholder="Ej. Hemocultivos → citrato → suero → heparina → EDTA → fluoruro"></label><small>Escribí la secuencia que aplicarías. El docente la revisará junto con tu resolución.</small></fieldset><button class="btn primary full" type="submit" id="submit-generated-response">Enviar resolución</button><p id="generated-submit-message" class="message"></p></form>`;
 $('#generated-student-form').addEventListener('submit',async e=>{
  e.preventDefault();const vacutainerOrder=$('#gs-vacutainer-order').value.trim();const response=rows.map((r,i)=>({determinacion:r.determinacion,area:$(`.gs-area[data-i="${i}"]`).value.trim(),muestra:$(`.gs-sample[data-i="${i}"]`).value.trim(),tubo:$(`.gs-tube[data-i="${i}"]`).value.trim(),preparacion:$(`.gs-fasting[data-i="${i}"]`).value.trim(),observaciones:$(`.gs-notes[data-i="${i}"]`).value.trim(),orden_llenado_vacutainer:vacutainerOrder}));
  const b=$('#submit-generated-response');b.disabled=true;b.textContent='Enviando…';
  const {data:result,error:submitError}=await sb.rpc('glp_submit_generated_order',{p_token:token,p_student_name:$('#generated-student-name').value.trim()||'Alumno',p_response:response});
  b.disabled=false;b.textContent='Enviar resolución';
  if(submitError){msg('#generated-submit-message','No se pudo enviar: '+submitError.message);return}
  const followUrl=`${location.origin}${location.pathname}?devolucion=${encodeURIComponent(result.access_code)}`;
  $('#generated-student-content').innerHTML=`<div class="result"><h3>Entrega registrada</h3><p>Tu resolución fue guardada correctamente.</p><p>Guardá este código: lo vas a necesitar para consultar tu corrección.</p><div class="tracking-code">${escapeHTML(result.access_code)}</div><button type="button" class="btn secondary" id="copy-generated-access-code">Copiar código</button><p><a href="${escapeHTML(followUrl)}">Abrir consulta de corrección</a></p><small>No compartas este código con otras personas: identifica tu entrega.</small></div>`;
  $('#copy-generated-access-code').addEventListener('click',()=>navigator.clipboard.writeText(result.access_code).then(()=>msg('#generated-feedback-result','Código copiado.')).catch(()=>prompt('Copiá tu código',result.access_code)));
  $('#generated-feedback-code').value=result.access_code;
 });
}
async function showGeneratedFeedback(code,hostSelector='#generated-feedback-result'){
 const host=$(hostSelector);host.innerHTML='<p class="muted">Buscando tu entrega…</p>';
 const {data,error}=await sb.rpc('glp_get_generated_feedback',{p_access_code:String(code||'').trim().toUpperCase()});
 if(error){host.innerHTML=`<p class="message">No se pudo consultar: ${escapeHTML(error.message)}</p>`;return}
 if(!data||data.found===false){host.innerHTML='<p class="message">No encontramos una entrega con ese código. Revisá que tenga 10 caracteres.</p>';return}
 if(data.review_status!=='graded'){
  host.innerHTML=`<div class="notice"><b>Tu entrega todavía está pendiente de corrección.</b><p>Cuando el docente publique la nota, vas a poder consultar aquí el resultado usando el mismo código.</p></div>`;return;
 }
 const response=Array.isArray(data.response)?data.response:[],expected=Array.isArray(data.answer_key)?data.answer_key:[],grades=Array.isArray(data.item_grades)?data.item_grades:[];
 host.innerHTML=`<div class="result"><h3>Corrección publicada</h3><p><b>Nota final: ${escapeHTML(data.teacher_grade)}/100</b></p><p>${escapeHTML(data.teacher_feedback||'Sin devolución general.')}</p><small>Entregado: ${new Date(data.submitted_at).toLocaleString('es-AR')}</small></div>${response[0]?.orden_llenado_vacutainer?`<div class="notice"><b>Tu orden de llenado Vacutainer</b><p>${escapeHTML(response[0].orden_llenado_vacutainer)}</p></div>`:''}`+response.map((r,i)=>{const k=expected[i]||{};return `<article class="generated-grade-item"><h4>${i+1}. ${escapeHTML(r.determinacion||'Determinación')} · ${escapeHTML(grades[i]??'—')}/100</h4><div class="two-col"><div><b>Tu respuesta</b><p>Área: ${escapeHTML(r.area||'—')}<br>Muestra: ${escapeHTML(r.muestra||'—')}<br>Tubo/aditivo: ${escapeHTML(r.tubo||'—')}<br>Preparación: ${escapeHTML(r.preparacion||'—')}<br>Observaciones: ${escapeHTML(r.observaciones||'—')}</p></div><div><b>Respuesta esperada</b><p>Área: ${escapeHTML(k.area||'No especificada')}<br>Muestra: ${escapeHTML(k.muestra||'No especificada')}<br>Tubo: ${escapeHTML(k.tubo||'No especificado')}<br>Aditivo: ${escapeHTML(k.aditivo||'No especificado')}<br>Ayuno: ${escapeHTML(k.ayuno||'No especificado')}<br>Toma: ${escapeHTML(k.toma||'No especificada')}<br>Procesamiento: ${escapeHTML(k.procesamiento||'No especificado')}<br>Condiciones: ${escapeHTML(k.condiciones||'No especificadas')}</p></div></div></article>`}).join('');
}
$('#generated-feedback-form').addEventListener('submit',async e=>{e.preventDefault();const code=$('#generated-feedback-code').value.trim().toUpperCase();if(code.length!==10){msg('#generated-feedback-result','El código debe tener 10 caracteres.');return}await showGeneratedFeedback(code)});
$('#home-feedback-form').addEventListener('submit',async e=>{e.preventDefault();const code=$('#home-feedback-code').value.trim().toUpperCase();if(code.length!==10){msg('#home-feedback-result','El código debe tener 10 caracteres.');return}await showGeneratedFeedback(code,'#home-feedback-result');});
async function openRandomSession(sessionToken){
 if(!sb){$('#generated-student-content').textContent='No se pudo conectar con el servidor.';return}
 go('pedido-generado');$('#generated-student-title').textContent='Actividad individual';$('#generated-student-instructions').textContent='Ingresá tu nombre para recibir un pedido aleatorio e individual.';$('#generated-student-meta').textContent='Evaluación por comisión';
 const host=$('#generated-student-content');host.innerHTML='<div class="notice">Cada alumno recibe una combinación diferente. Si volvés a entrar desde este navegador, recuperarás el mismo pedido.</div><form id="random-session-entry"><label>Nombre y apellido<input id="random-session-name" maxlength="100" placeholder="Tu nombre y apellido" required></label><button class="btn primary full" type="submit">Generar mi pedido</button><p id="random-session-message" class="message"></p></form>';
 const {data:session,error}=await sb.rpc('glp_get_random_session',{p_token:sessionToken});
 if(error||!session?.found){host.innerHTML=`<p class="message">No se pudo abrir esta actividad: ${escapeHTML(error?.message||'Enlace inexistente o cerrado')}.</p>`;return}
 $('#generated-student-title').textContent=session.title;$('#generated-student-instructions').textContent=session.instructions||'Completá la resolución de tu pedido individual.';$('#generated-student-meta').textContent=`${session.item_count} determinaciones · ${session.difficulty}`;
 const form=$('#random-session-entry');form.addEventListener('submit',async e=>{
  e.preventDefault();const name=$('#random-session-name').value.trim();if(!name){msg('#random-session-message','Ingresá tu nombre.');return}
  const key=makeClientKey(sessionToken,name),b=form.querySelector('button');b.disabled=true;b.textContent='Preparando pedido…';
  let assignment=null,assignmentError=null;
  const result=await sb.rpc('glp_create_random_assignment',{p_session_token:sessionToken,p_student_name:name,p_client_key:key});
  assignment=result.data;assignmentError=result.error;
  if(assignmentError||!assignment){b.disabled=false;b.textContent='Generar mi pedido';msg('#random-session-message','No se pudo generar el pedido: '+(assignmentError?.message||'Intentá nuevamente.'));return}
  localStorage.setItem('glp_random_name_'+sessionToken,name);
  location.href=`${location.origin}${location.pathname}?pedido=${encodeURIComponent(assignment.token)}`;
 });
}
async function initGeneratedOrderMode(){
 await loadDeterminationCatalog();
 const params=new URLSearchParams(location.search),token=params.get('pedido'),sessionToken=params.get('grupo'),accessCode=params.get('devolucion');
 if(token)await openGeneratedOrder(token);
 else if(sessionToken)await openRandomSession(sessionToken);
 else if(accessCode){go('pedido-generado');$('#generated-student-content').hidden=true;$('#generated-student-title').textContent='Consulta de corrección';$('#generated-student-instructions').textContent='Ingresá el código de seguimiento de tu entrega.';$('#generated-student-meta').textContent='Seguimiento';$('#generated-feedback-code').value=accessCode;await showGeneratedFeedback(accessCode)}
}
$('#generator-login-note').hidden=admin;
$('#generator-workspace').hidden=!admin;
const oldRefreshAdmin=refreshAdmin;
refreshAdmin=async function(){await oldRefreshAdmin();$('#generator-login-note').hidden=admin;$('#generator-workspace').hidden=!admin;if(admin){loadGeneratedOrders();loadAcademicRegister()}};
initGeneratedOrderMode();
