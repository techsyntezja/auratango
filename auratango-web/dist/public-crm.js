// Public, insert-only inquiry endpoint. Staff booking and payment are separate.
window.persistTrialLead=async function(trial){
 const config=window.AURA_CONFIG;
 if(!config?.supabaseUrl||!config.supabaseKey)throw Error('Trial inquiries are temporarily unavailable. Please contact the studio.');
 const d=trial.details;
 trial.crmSubmissionId||=crypto.randomUUID();
 let phone=String(d.phone||'').replace(/\D/g,'');
 if(phone&&!String(d.phone).startsWith('+'))phone=(typeof phoneCallingCodes!=='undefined'?phoneCallingCodes[d.phoneCountry||'PL']:'48')+phone;
 const data={submission_id:trial.crmSubmissionId,name:d.fullName,email:d.email,phone,contact_method:d.contactMethod||'Email',
 preference:[trial.offer==='ladies'?'Ladies’ Solo':'Partner group',trial.party==='couple'?'Couple':'One person',d.preferredLocation||'',d.preferredDate||'',d['trial-slot']||''].filter(Boolean).join(' · '),
 consent:d.agreeTerms==='on'&&d.agreePrivacy==='on',website:d.website||''};
 const response=await fetch(config.supabaseUrl.replace(/\/$/,'')+'/rest/v1/rpc/crm_trial_inquiry',{method:'POST',headers:{apikey:config.supabaseKey,'Content-Type':'application/json'},body:JSON.stringify({p_data:data})});
 if(!response.ok){const body=await response.json().catch(()=>({}));throw Error(body.message||'Your inquiry could not be saved. Please try again.');}
 trial.crmSaved=true;return response.json();
};

window.persistContactRequest=async function(form,reason,details={}){
 const config=window.AURA_CONFIG;if(!config?.supabaseUrl||!config.supabaseKey)throw Error('Requests are temporarily unavailable. Please try again later.');
 form.dataset.submissionId||=crypto.randomUUID();const data={...Object.fromEntries(new FormData(form)),...details,reason,submission_id:form.dataset.submissionId};
 const response=await fetch(config.supabaseUrl.replace(/\/$/,'')+'/rest/v1/rpc/crm_contact_inquiry',{method:'POST',headers:{apikey:config.supabaseKey,'Content-Type':'application/json'},body:JSON.stringify({p_data:data})});
 if(!response.ok){const body=await response.json().catch(()=>({}));throw Error(body.message||'Your request could not be sent. Please try again.');}
 const result=await response.json();if(!result?.saved)throw Error('Your request could not be confirmed. Please try again.');return result;
};
