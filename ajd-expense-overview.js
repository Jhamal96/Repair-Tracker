(function AJDExpenseOverview(){
'use strict';
const $=id=>document.getElementById(id);
const money=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(n)||0);
const qty=n=>new Intl.NumberFormat('en-US',{maximumFractionDigits:0}).format(Number(n)||0);
let client=null,currentYear='',lastRequest=0,loaded=false,latest=null;
function text(id,value){const el=$(id);if(el)el.textContent=String(value)}
function element(tag,value,className){
 const node=document.createElement(tag);
 if(value!==undefined&&value!==null)node.textContent=String(value);
 if(className)node.className=className;
 return node;
}
function yearText(year){return year?'Year '+year:'All Time'}
function fillYears(years){
 const selector=$('overviewYearFilter');
 const existing=selector.value;
 selector.replaceChildren();
 const all=element('option','All Years · Lifetime');all.value='';selector.appendChild(all);
 for(const value of years||[]){
  const year=Number(value);
  if(!Number.isInteger(year)||year<2000||year>2100)continue;
  const option=element('option',String(year));option.value=String(year);selector.appendChild(option);
 }
 selector.value=existing;
 if(selector.value!==existing)selector.value='';
 currentYear=selector.value;
}
function safeAmount(raw){
 const n=Number(raw);
 return Number.isFinite(n)&&n>=0?n:0;
}
function labelMonth(key){
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(key)))return String(key);
 const [year,month]=String(key).split('-').map(Number);
 return new Date(year,month-1,1).toLocaleDateString('en-US',{month:'short',year:'numeric'});
}
function drawBars(parentId,rows,type,selectedTotal){
 const root=$(parentId);root.replaceChildren();
 if(!Array.isArray(rows)||!rows.length){
  root.appendChild(element('p','No expenses recorded for this period.','expense-overview-empty'));
  return;
 }
 const highest=rows.reduce((s,item)=>Math.max(s,safeAmount(item.amount)),0);
 for(const row of rows){
  const total=safeAmount(row.amount);
  const label=type==='category'?String(row.category||'Other'):labelMonth(row.month);
  const line=element('div',null,'expense-overview-bar-row');
  const meta=element('div',null,'expense-overview-bar-meta');
  const left=element('div',null,'expense-overview-bar-left');
  const name=element('strong',label);
  const count=element('small',qty(row.count||0)+' expense'+(Number(row.count)===1?'':'s'));
  left.append(name,count);
  meta.append(left,element('b',money(total)));
  const track=element('div',null,'expense-overview-bar-track');
  const fill=element('div',null,'expense-overview-bar-fill '+(type==='month'?'is-month':'is-category'));
  const percent=highest>0?Math.max(0,Math.min(100,(total/highest)*100)):0;
  fill.style.width=percent.toFixed(2)+'%';
  fill.setAttribute('aria-hidden','true');
  track.append(fill);
  line.append(meta,track);
  if(type==='category'&&selectedTotal>0){
   line.appendChild(element('small',(total/selectedTotal*100).toFixed(1)+'% of selected period'));
  }
  root.appendChild(line);
 }
}
function showMessage(message,error=false){
 const box=$('overviewStatus');
 if(!box)return;
 box.textContent=message;
 box.className='expense-overview-status'+(error?' is-error':'');
 box.hidden=!message;
}
function draw(data){
 latest=data;
 const allTime=safeAmount(data.all_time_total);
 const selection=safeAmount(data.range_total);
 const number=Number(data.range_count)||0;
 text('allTimeStat',money(allTime));
 text('allTimeRecords',qty(data.all_time_count||0)+' recorded expenses · all dates');
 text('overviewPeriodTotal',money(selection));
 text('overviewThisYear',money(data.this_year_total));
 text('overviewThisMonth',money(data.this_month_total));
 text('overviewLifetimeRecords',qty(data.all_time_count||0));
 text('overviewPeriodCount',qty(number)+' expense'+(number===1?'':'s')+' in this period');
 text('overviewScopeTitle',currentYear?'Breakdown for '+currentYear:'Lifetime Spending Breakdown');
 text('overviewCategoryTotal',money(selection));
 text('overviewMonthTotal',money(selection));
 fillYears(data.years);
 drawBars('overviewCategoryBars',data.categories,'category',selection);
 drawBars('overviewMonthBars',data.months,'month',selection);
 showMessage('');
 loaded=true;
}
async function refresh(){
 if(!client)return;
 const requested=++lastRequest;
 const selected=$('overviewYearFilter')?.value||'';
 currentYear=selected;
 const button=$('overviewToggle');
 if(button)button.disabled=true;
 showMessage('Refreshing expense totals securely…');
 try{
  const year=selected?Number(selected):null;
  const {data,error}=await client.rpc('ajd_business_expense_overview',{p_year:year});
  if(requested!==lastRequest)return;
  if(error)throw error;
  if(!data||typeof data!=='object')throw Error('The expense summary was not returned by Supabase.');
  draw(data);
 }catch(error){
  if(requested!==lastRequest)return;
  showMessage('Unable to load the overall totals: '+error.message+'. Try refreshing the expenses page.',true);
  if(!loaded){text('allTimeStat','Unavailable');text('allTimeRecords','Total could not be verified');}
 }finally{
  if(requested===lastRequest&&button)button.disabled=false;
 }
}
function show(){
 const panel=$('expenseOverallPanel');
 const button=$('overviewToggle');
 if(!panel||!button)return;
 panel.hidden=false;
 button.setAttribute('aria-expanded','true');
 button.textContent='✕ Hide Overall Expenses';
 panel.scrollIntoView({behavior:'smooth',block:'start'});
}
function hide(){
 const panel=$('expenseOverallPanel'),button=$('overviewToggle');
 if(!panel||!button)return;
 panel.hidden=true;button.setAttribute('aria-expanded','false');
 button.textContent='📊 View Overall Expenses';
 button.focus({preventScroll:true});
}
function toggle(){
 if($('expenseOverallPanel').hidden)show();else hide();
}
function setYear(){
 currentYear=$('overviewYearFilter').value;
 void refresh();
}
function init(sb){
 client=sb;
 $('overviewToggle').addEventListener('click',toggle);
 $('overviewYearFilter').addEventListener('change',setYear);
 $('overviewClose').addEventListener('click',hide);
 window.addEventListener('pageshow',event=>{
  if(event.persisted&&client)void refresh();
 });
}
window.AJDExpenseOverview={init,refresh,show,hide};
})();