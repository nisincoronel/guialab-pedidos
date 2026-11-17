const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const cfg=window.GLP_CONFIG||{};
const configured=cfg.SUPABASE_URL&&cfg.SUPABASE_ANON_KEY&&!cfg.SUPABASE_URL.includes("TU-PROYECTO");
let sb=null,admin=false,currentCase=null;
const norm=s=>String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
function go(v){$$(".view").forEach(x=>x.classList.toggle("active",x.id==="view-"+v));$$(".nav").forEach(x=>x.classList.toggle("active",x.dataset.view===v));window.scrollTo({top:0,behavior:"smooth"});if(v==="biblioteca")loadCases();if(v==="docente")refreshAdmin();}
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

async function openCase(id){
 if(!requireBackend())return;
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
 box.className="result"+(data.score<60?" bad":"");
 box.innerHTML=`<b>Reconocimiento de determinaciones: ${data.score}%</b><br>Coincidencias: ${data.matched.length?data.matched.map(escapeHTML).join(", "):"No se reconocieron coincidencias."}<br>${data.missing.length?"Para revisar: "+data.missing.map(escapeHTML).join(", ")+"<br>":""}<br><b>Devolución docente</b><br>${escapeHTML(data.explanation||"Revisá la resolución del caso.")}${data.transcription?`<br><br><b>Transcripción docente</b><br>${escapeHTML(data.transcription)}`:""}<br><br><small>La puntuación automática de esta versión corresponde al reconocimiento de las determinaciones esperadas. Los campos de área, muestra, tubo y fase preanalítica se muestran para autoevaluación y todavía no tienen corrección automática independiente.</small>`;
});
$("#case-search").addEventListener("input",loadCases);$("#difficulty-filter").addEventListener("change",loadCases);
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
 if(admin)loadAdminCases();
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
if(sb)sb.auth.onAuthStateChange(()=>refreshAdmin());
refreshAdmin();
