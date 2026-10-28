/* AJD's Wireless Repairs • unified admin drawer, no extra dependencies */
(function(){
  'use strict';
  const isMain=Boolean(document.getElementById('tabBtnRepairs'));
  const currentPage=document.body.dataset.page||'';
  const PAGE_TABS=new Set(['repairs','history','invoices','store','inventory']);
  const LABELS={repairs:'Repairs',todo:'To-do List',history:'Repair History',invoices:'Invoices & Receipts',store:'Customer Requests',inventory:'Store Management',parts:'Inventory Tracker',expenses:'Business Expenses',plans:'Planned Purchases',links:'Manage Links',editor:'Link Editor',sync:'Cloud Synchronization',settings:'Settings'};
  const sections=[
    {name:'REPAIR WORKSPACE',items:[
      {id:'repairs',icon:'💻',label:'Repairs',description:'Active repair tickets',tab:'repairs'},
      {id:'todo',icon:'☑',label:'To-do List',description:'Shop reminders, follow-ups & daily tasks',url:'/todo'},
      {id:'history',icon:'🗂️',label:'Repair History',description:'Picked-up & declined repairs; reopen anytime',tab:'history'},
      {id:'invoices',icon:'🧾',label:'Invoices & Receipts',description:'Send invoices and record payments',tab:'invoices'},
      {id:'store',icon:'📥',label:'Customer Requests',description:'New inquiries and orders',tab:'store'}
    ]},
    {name:'BUSINESS & INVENTORY',items:[
      {id:'parts',icon:'📦',label:'Inventory Tracker',description:'Parts, accessories & stock alerts',url:'/inventory'},
      {id:'inventory',icon:'🛍️',label:'Store Management',description:'Products, prices and stock',tab:'inventory'},
      {id:'expenses',icon:'💼',label:'Business Expenses',description:'Track spending and export',url:'/expenses'},
      {id:'plans',icon:'🛒',label:'Planned Purchases',description:'Shopping wish list and budget',url:'/planned-purchases'}
    ]},
    {name:'ADMIN & SETTINGS',items:[
      {id:'links',icon:'🔗',label:'Manage Links',description:'View, organize & remove shortcuts',url:'/links'},
      {id:'editor',icon:'✎',label:'Link Editor',description:'Add or edit a shortcut',url:'/link-editor'},
      {id:'sync',icon:'☁️',label:'Cloud Synchronization',description:'Monitor & publish pending updates',url:'/cloud-sync'},
      {id:'settings',icon:'⚙️',label:'Settings',description:'Business contact, labor, theme',url:'/settings'},
       {id:'notifications',icon:'🔔',label:'Notifications',description:'Email, SMS, app push and alerts',url:'/settings#notifications'},
      {id:'downloads',icon:'⬇️',label:'Download App',description:'Windows, Mac, Android, iPhone & iPad',url:'/download'},
      {id:'account',icon:'👤',label:'Account Settings',description:'Email and password security',url:'/settings#account'},
      {id:'install',icon:'📲',label:'Install Admin App',description:'Put the app on your home screen',action:'install',installedOnly:true},
      {id:'backup',icon:'⬇️',label:'Export Backup',description:'Save a local copy of your data',action:'backup',mainOnly:true},
      {id:'signout',icon:'↪️',label:'Sign Out',description:'Lock your admin dashboard',action:'signout',mainOnly:true}
    ]},
    {name:'CUSTOMER-FACING PAGES',items:[
      {id:'storefront',icon:'🏪',label:'Public Storefront',description:'View the customer store',url:'/store'},
      {id:'request',icon:'🔧',label:'Request a Repair',description:'Customer service form',url:'/request'},
      {id:'tracking',icon:'📦',label:'Track a Repair',description:'Customer ticket lookup',url:'/track'}
    ]}
  ];
  let drawer,backdrop,toggle,search,contextText,quickPanel,quickButton,previousFocus=null,currentSection=isMain?'repairs':(LABELS[currentPage]?currentPage:'plans'),lastHandledHash='';
  const $=id=>document.getElementById(id);
  function make(tag,cls,text){
    const n=document.createElement(tag);
    if(cls)n.className=cls;
    if(text!==undefined)n.textContent=text;
    return n;
  }
  function setInstalled(){
    if(window.matchMedia('(display-mode: standalone)').matches||navigator.standalone===true||navigator.userAgent.includes('AJD-Android-App')){
      document.documentElement.classList.add('ajd-installed');
    }
  }
  function isDrawerOpen(){return document.body.classList.contains('ajd-menu-open')}
  function setDrawer(open,restoreFocus=true){
    if(!drawer)return;
    if(open&&isMain&&document.body.classList.contains('admin-locked'))return;
    if(open){
      previousFocus=document.activeElement;
      window.AJDCloudHealth?.closePanel();
      closeLegacyPanels();
      document.body.classList.add('ajd-menu-open');
      drawer.setAttribute('aria-hidden','false');
      toggle.setAttribute('aria-expanded','true');
      window.requestAnimationFrame(()=>{$('ajdMenuClose').focus({preventScroll:true})});
    }else{
      document.body.classList.remove('ajd-menu-open');
      drawer.setAttribute('aria-hidden','true');
      toggle.setAttribute('aria-expanded','false');
      if(restoreFocus&&previousFocus&&typeof previousFocus.focus==='function')previousFocus.focus({preventScroll:true});
    }
  }
  function closeLegacyPanels(){
    for(const id of ['settingsDropdownMenu','navLinksDropdownMenu']){
      const panel=$(id);
      if(panel)panel.classList.add('hidden');
    }
  }
  function activeSection(section){
    if(LABELS[section])currentSection=section;
    if(!drawer)return;
    drawer.querySelectorAll('.ajd-menu-item[data-ajd-id]').forEach(item=>{
      const match=item.dataset.ajdId===currentSection;
      item.classList.toggle('is-active',match);
      if(match)item.setAttribute('aria-current','page');
      else item.removeAttribute('aria-current');
    });
    if(contextText)contextText.textContent=LABELS[currentSection]||'Admin Dashboard';
  }
  function selectedTab(tab){
    if(!PAGE_TABS.has(tab)||!isMain)return;
    window.switchTab(tab);
    activeSection(tab);
    if(location.hash!=='#'+tab)history.replaceState(null,'',location.pathname+location.search+'#'+tab);
    setDrawer(false,false);
  }
  function launchLegacy(kind){
    if(!isMain){
      window.location.href='/#'+kind;
      return;
    }
    if(document.body.classList.contains('admin-locked'))return;
    closeLegacyPanels();
    if(['links','settings','sync','account'].includes(kind)){
      window.location.href=({links:'/links',settings:'/settings',sync:'/cloud-sync',account:'/settings#account'})[kind];
    }else if(kind==='install'){
      if(typeof window.installAdminApp==='function')window.installAdminApp();
    }else if(kind==='backup'){
      if(typeof window.exportBackup==='function')window.exportBackup();
    }else if(kind==='signout'){
      if(typeof window.signOutAdmin==='function')window.signOutAdmin();
    }
  }
  function handleItem(item){
    setDrawer(false,false);
    if(item.tab){
      if(isMain)selectedTab(item.tab);
      else window.location.href='/#'+item.tab;
    }else if(item.url){
      window.location.href=item.url;
    }else if(item.action){
      window.requestAnimationFrame(()=>launchLegacy(item.action));
    }
  }
  function filterMenu(){
    const term=search.value.trim().toLocaleLowerCase();
    let total=0;
    drawer.querySelectorAll('.ajd-menu-section').forEach(section=>{
      let count=0;
      section.querySelectorAll('.ajd-menu-item').forEach(node=>{
        const match=(node.dataset.ajdSearch||'').includes(term);
        node.hidden=!match;if(match)count++;
      });
      section.hidden=!count;total+=count;
    });
    $('ajdMenuEmpty').hidden=total>0;
  }
  function handleHash(){
    if(!isMain||document.body.classList.contains('admin-locked'))return;
    const hash=decodeURIComponent(location.hash.slice(1)||'');
    if(!hash||hash===lastHandledHash)return;
    lastHandledHash=hash;
    if(PAGE_TABS.has(hash))selectedTab(hash);
    else if(['links','settings','sync','account'].includes(hash))launchLegacy(hash);
  }
  function inject(){
    // The menu lives at the start of the actual header row, outside the brand.
    // This keeps it flush-left on both the dashboard and secondary admin pages.
    const headerRow=isMain?
      document.querySelector('header .max-w-7xl'):
      document.querySelector('header .top');
    if(!headerRow)return;
    headerRow.closest('header').classList.add('ajd-compact-header');
    setInstalled();
    toggle=make('button','ajd-menu-button');
    toggle.id='ajdMenuToggle';
    toggle.type='button';
    toggle.setAttribute('aria-label','Open navigation menu');
    toggle.setAttribute('aria-controls','ajdMenuDrawer');
    toggle.setAttribute('aria-expanded','false');
    const hamburger=make('span','ajd-hamburger');
    hamburger.setAttribute('aria-hidden','true');
    hamburger.append(make('i'),make('i'),make('i'));
    toggle.append(hamburger,make('span','ajd-menu-text-label','Menu'));
    headerRow.prepend(toggle);
    const right=isMain?document.querySelector('header .max-w-7xl > div:nth-of-type(2)'):make('div');
    right.classList.add('ajd-header-actions');
    if(!isMain)headerRow.append(right);
    contextText=isMain?headerRow.querySelector('h1 + p'):headerRow.querySelector('.brand .sub');
    // Replace cramped dropdown controls with a dedicated quick-links icon in
    // the far-right header position. Keep legacy DOM only for old data handlers.
    if(isMain){
      for(const id of ['navLinksDropdownMenu','settingsDropdownMenu']){
        const legacy=$(id)?.parentElement;
        if(legacy)legacy.classList.add('ajd-legacy-control-hidden');
      }
    }
    const quickTarget=right;
    window.AJDCloudHealth?.mount(quickTarget);
    const quickWrap=make('div','ajd-quick-links-wrap');
    quickWrap.id='ajdQuickLinks';
    quickButton=make('button','ajd-quick-links-button');
    quickButton.id='ajdQuickLinksButton';
    quickButton.type='button';
    quickButton.setAttribute('aria-label','Open saved quick links');
    quickButton.setAttribute('aria-controls','ajdQuickLinksPanel');
    quickButton.setAttribute('aria-expanded','false');
    quickButton.title='Quick Links';
    const quickSVG=document.createElementNS('http://www.w3.org/2000/svg','svg');
    quickSVG.setAttribute('viewBox','0 0 24 24');quickSVG.setAttribute('width','21');quickSVG.setAttribute('height','21');
    quickSVG.setAttribute('fill','none');quickSVG.setAttribute('stroke','currentColor');
    quickSVG.setAttribute('stroke-width','2.25');quickSVG.setAttribute('stroke-linecap','round');quickSVG.setAttribute('stroke-linejoin','round');
    quickSVG.setAttribute('aria-hidden','true');
    const quickPath=document.createElementNS('http://www.w3.org/2000/svg','path');
    quickPath.setAttribute('d','M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 1 0-7.07-7.07l-1.72 1.71 M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 1 0 7.07 7.07l1.71-1.71');
    quickSVG.appendChild(quickPath);quickButton.appendChild(quickSVG);
    quickPanel=make('div','ajd-quick-links-panel');
    quickPanel.id='ajdQuickLinksPanel';quickPanel.hidden=true;
    quickPanel.setAttribute('role','region');quickPanel.setAttribute('aria-label','Your saved quick links');
    const safeQuickUrl=value=>{
      const raw=String(value||'').trim();
      if(!raw||raw.startsWith('//')||/[\u0000-\u001f\u007f]/.test(raw))return '';
      if(/^\/(?!\/)[a-z0-9_./?&=%+#-]*$/i.test(raw))return raw;
      try{
        const u=new URL(raw);
        if(['https:','http:'].includes(u.protocol))return u.href;
        if(u.protocol==='tel:'||u.protocol==='mailto:')return raw;
      }catch(_){}
      return '';
    };
    const drawQuickLinks=()=>{
      quickPanel.replaceChildren();
      const heading=make('div','ajd-quick-links-header','🔗 Quick Links');quickPanel.appendChild(heading);
      let saved=[];
      try{const parsed=JSON.parse(localStorage.getItem('ajd_managed_links_v1')||'[]');if(Array.isArray(parsed))saved=parsed}catch(_){}
      if(!saved.length)saved=[
        {label:'Customer Storefront',url:'/store',icon:'🏪'},
        {label:'Repair Tracking',url:'/track',icon:'📦'},
        {label:'Request Repair',url:'/request',icon:'🔧'}
      ];
      let shown=0;
      for(const link of saved){
        const href=safeQuickUrl(link.url);
        if(!href)continue;
        const a=make('a','ajd-quick-links-item');
        a.href=href;a.target=href.startsWith('tel:')||href.startsWith('mailto:')?'_self':'_blank';
        if(a.target==='_blank')a.rel='noopener noreferrer';
        a.append(make('span','ajd-quick-icon',link.icon||'🔗'),make('span','',link.label||href));
        quickPanel.append(a);shown++;
      }
      if(!shown)quickPanel.appendChild(make('p','ajd-quick-links-empty','No saved quick links yet.'));
      const actions=make('div','ajd-quick-links-actions');
      const manage=make('a','','Manage Links');manage.href='/links';
      const create=make('a','','＋ Add Link');create.href='/link-editor';
      actions.append(manage,create);quickPanel.append(actions);
    };
    const toggleQuick=visible=>{
      quickPanel.hidden=!visible;
      quickButton.setAttribute('aria-expanded',String(visible));
      if(visible){drawQuickLinks();if(isDrawerOpen())setDrawer(false,false);}
    };
    quickButton.addEventListener('click',event=>{
      window.AJDCloudHealth?.closePanel();
      event.stopPropagation();toggleQuick(quickPanel.hidden);
    });
    document.addEventListener('click',event=>{
      if(!quickWrap.contains(event.target)&&!quickPanel.hidden)toggleQuick(false);
    });
    document.addEventListener('keydown',event=>{
      if(event.key==='Escape'&&!quickPanel.hidden){toggleQuick(false);quickButton.focus();event.stopPropagation();}
    });
    quickWrap.append(quickButton,quickPanel);
    quickTarget?.appendChild(quickWrap);
    backdrop=make('div');backdrop.id='ajdMenuBackdrop';backdrop.setAttribute('aria-hidden','true');
    drawer=make('aside');
    drawer.id='ajdMenuDrawer';
    drawer.setAttribute('role','dialog');
    drawer.setAttribute('aria-label','AJD admin navigation');
    drawer.setAttribute('aria-modal','true');
    drawer.setAttribute('aria-hidden','true');
    drawer.tabIndex=-1;
    const head=make('div','ajd-drawer-head');
    const brand=make('div','ajd-drawer-brand');
    const logo=make('img','ajd-drawer-logo');
    logo.src='/ajd-logo.svg?v=20261024-logo2';
    logo.alt="AJD's Wireless Repairs logo";
    logo.width=45;logo.height=45;logo.decoding='async';
    const brandCopy=make('div');
    brandCopy.append(make('strong','',"AJD's Wireless Repairs"),make('p','','Admin Command Center'));
    const close=make('button','ajd-drawer-close');
    close.id='ajdMenuClose';close.type='button';close.setAttribute('aria-label','Close navigation menu');
    const closeIcon=document.createElementNS('http://www.w3.org/2000/svg','svg');
    closeIcon.setAttribute('viewBox','0 0 24 24');
    closeIcon.setAttribute('width','20');
    closeIcon.setAttribute('height','20');
    closeIcon.setAttribute('fill','none');
    closeIcon.setAttribute('stroke','currentColor');
    closeIcon.setAttribute('stroke-width','2.6');
    closeIcon.setAttribute('stroke-linecap','round');
    closeIcon.setAttribute('aria-hidden','true');
    const closePath=document.createElementNS('http://www.w3.org/2000/svg','path');
    closePath.setAttribute('d','M6 6L18 18M18 6L6 18');
    closeIcon.appendChild(closePath);
    close.appendChild(closeIcon);
    brand.append(logo,brandCopy,close);
    const searchWrap=make('label','ajd-drawer-search');
    searchWrap.append(make('span','', '⌕'));
    search=make('input');
    search.id='ajdMenuSearch';search.type='search';search.autocomplete='off';
    search.placeholder='Search tools and pages…';search.setAttribute('aria-label','Search menu options');
    searchWrap.appendChild(search);
    head.append(brand,searchWrap);
    const scroll=make('nav','ajd-drawer-scroll');
    scroll.setAttribute('aria-label','Dashboard sections');
    for(const group of sections){
      const section=make('section','ajd-menu-section');
      section.append(make('div','ajd-menu-label',group.name));
      for(const item of group.items){
        if(item.mainOnly&&!isMain)continue;
        const node=make('button','ajd-menu-item');
        node.type='button';
        node.dataset.ajdId=item.id;
        node.dataset.ajdSearch=(item.label+' '+item.description+' '+group.name).toLocaleLowerCase();
        if(item.installedOnly)node.setAttribute('data-ajd-install','');
        node.append(make('span','ajd-menu-icon',item.icon));
        const copy=make('span','ajd-menu-text');
        copy.append(make('b','',item.label),make('small','',item.description));
        node.append(copy,make('span','ajd-menu-chevron','›'));
        node.addEventListener('click',()=>handleItem(item));
        section.append(node);
      }
      scroll.appendChild(section);
    }
    const empty=make('p','ajd-menu-empty','No matching pages or tools.');
    empty.id='ajdMenuEmpty';empty.hidden=true;scroll.appendChild(empty);
    const bottom=make('div','ajd-drawer-bottom');
    bottom.append(make('div','ajd-drawer-secure','Protected Admin Workspace'),make('p','',"AJD's Wireless Repairs • Secure Supabase access"));
    drawer.append(head,scroll,bottom);
    document.body.append(backdrop,drawer);
    toggle.addEventListener('click',()=>setDrawer(!isDrawerOpen()));
    close.addEventListener('click',()=>setDrawer(false));
    backdrop.addEventListener('click',()=>setDrawer(false));
    search.addEventListener('input',filterMenu);
    document.addEventListener('keydown',event=>{
      if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='k'){
        event.preventDefault();if(!isDrawerOpen())setDrawer(true);window.requestAnimationFrame(()=>search.focus());return;
      }
      if(!isDrawerOpen())return;
      if(event.key==='Escape'){event.preventDefault();setDrawer(false);return}
      if(event.key==='Tab'){
        const candidates=[...drawer.querySelectorAll('button:not([hidden]):not(:disabled),input:not([hidden])')].filter(el=>el.getClientRects().length);
        if(!candidates.length)return;
        const first=candidates[0],last=candidates[candidates.length-1];
        if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}
        else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
      }
    });
    if(window.matchMedia){
      try{window.matchMedia('(display-mode: standalone)').addEventListener('change',e=>{
        document.documentElement.classList.toggle('ajd-installed',e.matches||navigator.standalone===true||navigator.userAgent.includes('AJD-Android-App'));
      })}catch(_){}
    }
    activeSection(currentSection);
    if(isMain){
      const prev=window.switchTab;
      if(typeof prev==='function'){
        window.switchTab=function(tab){const result=prev.apply(this,arguments);activeSection(tab);return result};
      }
      const observer=new MutationObserver(()=>{
        if(document.body.classList.contains('admin-locked')){
          if(isDrawerOpen())setDrawer(false,false);
          closeLegacyPanels();
        }else handleHash();
      });
      observer.observe(document.body,{attributes:true,attributeFilter:['class']});
      window.addEventListener('hashchange',()=>{lastHandledHash='';handleHash()});
      handleHash();
    }
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',inject);
  else inject();
})();
