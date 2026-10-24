/* AJD's Wireless Repairs • unified admin drawer, no extra dependencies */
(function(){
  'use strict';
  const isMain=Boolean(document.getElementById('tabBtnRepairs'));
  const currentPage=document.body.dataset.page||'';
  const PAGE_TABS=new Set(['repairs','history','invoices','store','inventory']);
  const LABELS={repairs:'Repairs',history:'Repair History',invoices:'Receipts',store:'Customer Requests',inventory:'Store Management',parts:'Inventory Tracker',expenses:'Business Expenses',plans:'Planned Purchases'};
  const sections=[
    {name:'REPAIR WORKSPACE',items:[
      {id:'repairs',icon:'💻',label:'Repairs',description:'Active repair tickets',tab:'repairs'},
      {id:'history',icon:'🗂️',label:'Repair History',description:'Completed and picked-up jobs',tab:'history'},
      {id:'invoices',icon:'🧾',label:'Receipts',description:'Payments and customer invoices',tab:'invoices'},
      {id:'store',icon:'📥',label:'Customer Requests',description:'New inquiries and orders',tab:'store'}
    ]},
    {name:'BUSINESS & INVENTORY',items:[
      {id:'parts',icon:'📦',label:'Inventory Tracker',description:'Parts, accessories & stock alerts',url:'/inventory'},
      {id:'inventory',icon:'🛍️',label:'Store Management',description:'Products, prices and stock',tab:'inventory'},
      {id:'expenses',icon:'💼',label:'Business Expenses',description:'Track spending and export',url:'/expenses'},
      {id:'plans',icon:'🛒',label:'Planned Purchases',description:'Shopping wish list and budget',url:'/planned-purchases'}
    ]},
    {name:'ADMIN & SETTINGS',items:[
      {id:'links',icon:'🔗',label:'Manage Links',description:'Edit important site links',action:'links'},
      {id:'sync',icon:'☁️',label:'Cloud Synchronization',description:'Back up and sync with Supabase',action:'sync'},
      {id:'settings',icon:'⚙️',label:'Settings',description:'Business details, labor, theme',action:'settings'},
      {id:'downloads',icon:'⬇️',label:'Download App',description:'Windows, Mac, Android, iPhone & iPad',url:'/download'},
      {id:'account',icon:'👤',label:'Account Settings',description:'Email and password security',action:'account'},
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
  let drawer,backdrop,toggle,search,chip,previousFocus=null,currentSection=isMain?'repairs':currentPage==='expenses'?'expenses':currentPage==='parts'?'parts':'plans',lastHandledHash='';
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
    if(chip){
      chip.querySelector('span:last-child').textContent=LABELS[currentSection]||'Admin Dashboard';
    }
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
    if(kind==='links'||kind==='settings'){
      const panel=$(kind==='links'?'navLinksDropdownMenu':'settingsDropdownMenu');
      if(panel){panel.classList.remove('hidden');if(kind==='settings')panel.scrollTop=0;}
    }else if(kind==='sync'){
      if(typeof window.openCloudSettings==='function')window.openCloudSettings();
    }else if(kind==='account'){
      if(typeof window.openAccountSettings==='function')window.openAccountSettings();
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
    const right=isMain?
      document.querySelector('header .max-w-7xl > div:nth-of-type(2)'):
      headerRow;
    chip=make('div');
    chip.id='ajdActiveChip';
    chip.setAttribute('aria-label','Current admin section');
    chip.append(make('span','ajd-active-dot'),make('span','',LABELS[currentSection]||'Admin Dashboard'));
    // On secondary pages the header itself is a flex row; append the chip
    // after the brand instead of accidentally putting it before the menu.
    if(right){if(isMain)right.prepend(chip);else right.append(chip);}
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
    const logo=make('span','ajd-drawer-logo','AJD');
    const brandCopy=make('div');
    brandCopy.append(make('strong','',"AJD's Wireless Repairs"),make('p','','Admin Command Center'));
    const close=make('button','ajd-drawer-close','×');
    close.id='ajdMenuClose';close.type='button';close.setAttribute('aria-label','Close navigation menu');
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