/* AJD's Wireless Repairs • Store inventory guided device catalog.
   Brand/family/model selection helps build the existing saved title/category.
   Supabase continues storing the same product fields; no schema changes needed. */
(function(){
'use strict';
const CATEGORIES=['Phones','Tablets','Smartwatches','Laptops','Desktop Computers','Audio & Headphones','Gaming Consoles','Accessories','Parts','Networking','Other'];
const OTHER='Other / Unlisted';
const pick=(id)=>document.getElementById(id);
const numeric=(a,b)=>Array.from({length:b-a+1},(_,i)=>String(a+i));
const named=(prefix,parts)=>parts.map(v=>prefix+' '+v);
const variants=(prefix,series,variants)=>series.flatMap(s=>variants.map(v=>prefix+s+(v?' '+v:'')));
const unique=list=>[...new Set(list.filter(Boolean))];
const DEVICES={
  Phones:{
    Apple:{
      'iPhone':[
        ...['17','16','15','14','13','12','11'].flatMap(year=>{
          const variantsByYear={'17':['','Air','Pro','Pro Max'],'16':['','Plus','Pro','Pro Max','16e'],'15':['','Plus','Pro','Pro Max'],'14':['','Plus','Pro','Pro Max'],'13':['','mini','Pro','Pro Max'],'12':['','mini','Pro','Pro Max'],'11':['','Pro','Pro Max']};
          return variantsByYear[year].map(v=>v==='16e'?'iPhone 16e':'iPhone '+year+(v?' '+v:''));
        }),
        'iPhone 18 Pro','iPhone 18 Pro Max','iPhone Duo','iPhone Air','iPhone 17e','iPhone XS Max','iPhone XS','iPhone XR','iPhone X','iPhone 8 Plus','iPhone 8','iPhone 7 Plus','iPhone 7',
        'iPhone 6s Plus','iPhone 6s','iPhone 6 Plus','iPhone 6','iPhone 5s','iPhone 5c','iPhone 5',
        'iPhone SE (3rd generation)','iPhone SE (2nd generation)','iPhone SE (1st generation)'
      ]
    },
    Samsung:{
      'Galaxy S':[
        ...numeric(20,26).flatMap(n=>['Galaxy S'+n,'Galaxy S'+n+'+','Galaxy S'+n+' Ultra',...(['21','23','24','26'].includes(n)?['Galaxy S'+n+' FE']:[])]),
        'Galaxy S10e','Galaxy S10','Galaxy S10+','Galaxy S10 5G','Galaxy S9','Galaxy S9+','Galaxy S8','Galaxy S8+'
      ],
      'Galaxy Z Fold':numeric(2,7).map(n=>'Galaxy Z Fold'+n).concat(['Galaxy Fold','Galaxy Z Fold Special Edition']),
      'Galaxy Z Flip':numeric(3,7).map(n=>'Galaxy Z Flip'+n).concat(['Galaxy Z Flip','Galaxy Z Flip 5G','Galaxy Z Flip FE']),
      'Galaxy A':named('Galaxy', ['A01','A02','A03','A04','A05','A06','A10','A11','A12','A13','A14','A15','A16','A20','A21','A22','A23','A24','A25','A26','A30','A31','A32','A33','A34','A35','A36','A50','A51','A52','A53','A54','A55','A56','A70','A71','A72','A73']),
      'Galaxy Note':named('Galaxy',['Note8','Note9','Note10','Note10+','Note10 Lite','Note20','Note20 Ultra']),
      'Galaxy M':named('Galaxy',['M13','M14','M15','M16','M23','M33','M34','M35','M36','M52','M53','M54','M55'])
    },
    Google:{
      'Pixel':numeric(3,10).flatMap(n=>['Pixel '+n,...(n>=6?['Pixel '+n+' Pro']:[]),...((n==='9'||n==='10')?['Pixel '+n+' Pro XL']:[]),...(n>=6?['Pixel '+n+'a']:[])]).concat(['Pixel','Pixel XL','Pixel 2','Pixel 2 XL','Pixel 3a','Pixel 3a XL','Pixel 4a','Pixel 4a 5G','Pixel 5a']),
      'Pixel Fold': ['Pixel Fold','Pixel 9 Pro Fold','Pixel 10 Pro Fold']
    },
    Motorola:{
      'Razr': ['Razr 2023','Razr+ 2023','Razr 2024','Razr+ 2024','Razr 2025','Razr+ 2025','Razr Ultra 2025','Razr 2026','Razr+ 2026'],
      'Edge': ['Edge 2022','Edge 2023','Edge+ 2023','Edge 2024','Edge 2025','Edge 40','Edge 40 Pro','Edge 50','Edge 50 Pro','Edge 50 Ultra','Edge 60','Edge 60 Pro'],
      'Moto G': ['Moto G Power 2022','Moto G Power 2023','Moto G Power 2024','Moto G Power 2025','Moto G Stylus 2022','Moto G Stylus 2023','Moto G Stylus 2024','Moto G Stylus 2025','Moto G Play 2023','Moto G Play 2024','Moto G 2025','Moto G 5G 2024','Moto G 5G 2025']
    },
    OnePlus:{
      'OnePlus Flagship':['OnePlus 8','OnePlus 8T','OnePlus 9','OnePlus 9 Pro','OnePlus 10 Pro','OnePlus 10T','OnePlus 11','OnePlus 11R','OnePlus 12','OnePlus 12R','OnePlus 13','OnePlus 13R','OnePlus 15','OnePlus 15R'],
      'Nord':['OnePlus Nord','OnePlus Nord 2','OnePlus Nord 2T','OnePlus Nord 3','OnePlus Nord 4','OnePlus Nord 5','OnePlus Nord N10','OnePlus Nord N20','OnePlus Nord N30','OnePlus Nord N200','OnePlus Nord N300'],
      'Foldable':['OnePlus Open','OnePlus Open Apex Edition']
    },
    Xiaomi:{
      'Xiaomi': ['Xiaomi 11','Xiaomi 11T','Xiaomi 12','Xiaomi 12 Pro','Xiaomi 12T','Xiaomi 13','Xiaomi 13 Pro','Xiaomi 13 Ultra','Xiaomi 14','Xiaomi 14 Pro','Xiaomi 14 Ultra','Xiaomi 15','Xiaomi 15 Pro','Xiaomi 15 Ultra','Xiaomi 17','Xiaomi 17 Pro','Xiaomi 17 Pro Max'],
      'MIX':['Xiaomi MIX Fold 2','Xiaomi MIX Fold 3','Xiaomi MIX Fold 4','Xiaomi MIX Flip']
    },
    Redmi:{
      'Redmi Note':['Redmi Note 10','Redmi Note 10 Pro','Redmi Note 11','Redmi Note 11 Pro','Redmi Note 12','Redmi Note 12 Pro','Redmi Note 13','Redmi Note 13 Pro','Redmi Note 14','Redmi Note 14 Pro','Redmi Note 14 Pro+','Redmi Note 15','Redmi Note 15 Pro'],
      'Redmi':['Redmi 10','Redmi 11','Redmi 12','Redmi 13','Redmi 14C','Redmi 15','Redmi A3','Redmi A5']
    },
    POCO:{
      'POCO F':['POCO F3','POCO F4','POCO F5','POCO F5 Pro','POCO F6','POCO F6 Pro','POCO F7','POCO F7 Pro','POCO F7 Ultra'],
      'POCO X':['POCO X3','POCO X4 Pro','POCO X5','POCO X5 Pro','POCO X6','POCO X6 Pro','POCO X7','POCO X7 Pro'],
      'POCO M':['POCO M4','POCO M5','POCO M6','POCO M6 Pro','POCO M7','POCO M7 Pro']
    },
    OPPO:{
      'Find X':['OPPO Find X3','OPPO Find X3 Pro','OPPO Find X5','OPPO Find X5 Pro','OPPO Find X6 Pro','OPPO Find X7 Ultra','OPPO Find X8','OPPO Find X8 Pro','OPPO Find X8 Ultra','OPPO Find X9'],
      'Find N':['OPPO Find N2','OPPO Find N2 Flip','OPPO Find N3','OPPO Find N3 Flip','OPPO Find N5'],
      'Reno':['OPPO Reno 8','OPPO Reno 8 Pro','OPPO Reno 10','OPPO Reno 10 Pro','OPPO Reno 11','OPPO Reno 12','OPPO Reno 13','OPPO Reno 14']
    },
    vivo:{
      'vivo X':['vivo X80','vivo X80 Pro','vivo X90','vivo X90 Pro','vivo X100','vivo X100 Pro','vivo X200','vivo X200 Pro','vivo X200 Ultra','vivo X300','vivo X300 Pro'],
      'vivo V':['vivo V25','vivo V27','vivo V29','vivo V30','vivo V40','vivo V50','vivo V60'],
      'iQOO':['iQOO 9','iQOO 10','iQOO 11','iQOO 12','iQOO 13','iQOO Neo 9','iQOO Neo 10']
    },
    realme:{
      'GT':['realme GT 2','realme GT 2 Pro','realme GT 3','realme GT 5','realme GT 6','realme GT 7','realme GT 7 Pro'],
      'Number Series':['realme 10','realme 11','realme 12','realme 12 Pro','realme 13','realme 14','realme 15'],
      'C Series':['realme C35','realme C53','realme C55','realme C61','realme C63','realme C67','realme C75']
    },
    Nothing:{
      'Phone':['Nothing Phone (1)','Nothing Phone (2)','Nothing Phone (2a)','Nothing Phone (2a) Plus','Nothing Phone (3)','Nothing Phone (3a)','Nothing Phone (3a) Pro'],
      'CMF Phone':['CMF Phone 1','CMF Phone 2 Pro']
    },
    Sony:{
      'Xperia 1':['Xperia 1 III','Xperia 1 IV','Xperia 1 V','Xperia 1 VI','Xperia 1 VII'],
      'Xperia 5':['Xperia 5 III','Xperia 5 IV','Xperia 5 V'],
      'Xperia 10':['Xperia 10 IV','Xperia 10 V','Xperia 10 VI','Xperia 10 VII']
    },
    ASUS:{
      'ROG Phone':['ROG Phone 5','ROG Phone 6','ROG Phone 7','ROG Phone 8','ROG Phone 8 Pro','ROG Phone 9','ROG Phone 9 Pro'],
      'Zenfone':['Zenfone 8','Zenfone 9','Zenfone 10','Zenfone 11 Ultra','Zenfone 12 Ultra']
    },
    'Nokia / HMD':{
      'Nokia':['Nokia G21','Nokia G22','Nokia G42','Nokia G60','Nokia X10','Nokia X20','Nokia X30','Nokia XR20','Nokia XR21'],
      'HMD':['HMD Pulse','HMD Pulse Pro','HMD Skyline','HMD Fusion','HMD Crest']
    },
    HONOR:{
      'Magic':['HONOR Magic5','HONOR Magic5 Pro','HONOR Magic6','HONOR Magic6 Pro','HONOR Magic7 Pro','HONOR Magic V2','HONOR Magic V3','HONOR Magic V5'],
      'Number Series':['HONOR 70','HONOR 90','HONOR 200','HONOR 200 Pro','HONOR 400','HONOR 400 Pro']
    },
    Huawei:{
      'P Series':['Huawei P30','Huawei P30 Pro','Huawei P40','Huawei P40 Pro','Huawei P50 Pro','Huawei P60 Pro','Huawei Pura 70','Huawei Pura 70 Pro','Huawei Pura 80 Pro'],
      'Mate':['Huawei Mate 40 Pro','Huawei Mate 50 Pro','Huawei Mate 60 Pro','Huawei Mate 70 Pro','Huawei Mate X3','Huawei Mate X5','Huawei Mate XT']
    },
    TCL:{'TCL':['TCL 20 Pro','TCL 30','TCL 30 XE','TCL 40 XE','TCL 40 XL','TCL 50 XE','TCL 50 XL','TCL 60 XE']},
    ZTE:{'ZTE':['ZTE Axon 30','ZTE Axon 40 Ultra','ZTE Axon 50 Ultra','ZTE Axon 60 Ultra','ZTE Blade A73','ZTE Blade V50']},
    LG:{'LG Legacy':['LG V30','LG V40','LG V50','LG V60 ThinQ','LG G7 ThinQ','LG G8 ThinQ','LG Velvet','LG Wing','LG Stylo 6']},
    HTC:{'HTC':['HTC U11','HTC U12+','HTC U23 Pro','HTC U24 Pro','HTC Desire 22 Pro']},
    Lenovo:{'Legion':['Lenovo Legion Phone Duel','Lenovo Legion Phone Duel 2','Lenovo Legion Y70','Lenovo Legion Y90']},
    TECNO:{'TECNO':['TECNO Camon 20','TECNO Camon 30','TECNO Camon 40','TECNO Phantom V Fold','TECNO Phantom V Fold2','TECNO Spark 20','TECNO Spark 30','TECNO Pova 6']},
    Infinix:{'Infinix':['Infinix Note 30','Infinix Note 40','Infinix Note 50','Infinix Zero 30','Infinix Zero 40','Infinix Hot 40','Infinix Hot 50','Infinix GT 20 Pro']},
    BlackBerry:{'BlackBerry Legacy':['BlackBerry KEYone','BlackBerry KEY2','BlackBerry KEY2 LE','BlackBerry Priv','BlackBerry Passport','BlackBerry Classic']},
    Fairphone:{'Fairphone':['Fairphone 3','Fairphone 4','Fairphone 5','Fairphone (Gen. 6)']}
  },
  Tablets:{
    Apple:{
      'iPad Pro':['iPad Pro 11-inch (M4)','iPad Pro 13-inch (M4)','iPad Pro 11-inch (M5)','iPad Pro 13-inch (M5)','iPad Pro 11-inch (M2)','iPad Pro 12.9-inch (M2)','iPad Pro 11-inch (M1)','iPad Pro 12.9-inch (M1)','iPad Pro (older model)'],
      'iPad Air':['iPad Air 11-inch (M3)','iPad Air 13-inch (M3)','iPad Air 11-inch (M2)','iPad Air 13-inch (M2)','iPad Air (5th generation)','iPad Air (4th generation)','iPad Air (3rd generation)'],
      'iPad':['iPad (A16)','iPad (10th generation)','iPad (9th generation)','iPad (8th generation)','iPad (7th generation)','iPad (6th generation)'],
      'iPad mini':['iPad mini (A17 Pro)','iPad mini (6th generation)','iPad mini (5th generation)','iPad mini (4th generation)']
    },
    Samsung:{
      'Galaxy Tab S':['Galaxy Tab S6','Galaxy Tab S6 Lite','Galaxy Tab S7','Galaxy Tab S7+','Galaxy Tab S7 FE','Galaxy Tab S8','Galaxy Tab S8+','Galaxy Tab S8 Ultra','Galaxy Tab S9','Galaxy Tab S9+','Galaxy Tab S9 Ultra','Galaxy Tab S9 FE','Galaxy Tab S9 FE+','Galaxy Tab S10+','Galaxy Tab S10 Ultra','Galaxy Tab S10 FE','Galaxy Tab S11','Galaxy Tab S11 Ultra'],
      'Galaxy Tab A':['Galaxy Tab A7','Galaxy Tab A8','Galaxy Tab A9','Galaxy Tab A9+','Galaxy Tab A11','Galaxy Tab A11+'],
      'Galaxy Tab Active':['Galaxy Tab Active3','Galaxy Tab Active4 Pro','Galaxy Tab Active5']
    },
    Google:{'Pixel Tablet':['Pixel Tablet']},
    Microsoft:{'Surface':['Surface Pro 7','Surface Pro 8','Surface Pro 9','Surface Pro 10','Surface Pro 11','Surface Go 2','Surface Go 3','Surface Go 4']},
    Lenovo:{'Lenovo Tab':['Lenovo Tab M10','Lenovo Tab M11','Lenovo Tab P11','Lenovo Tab P12','Lenovo Yoga Tab 13','Lenovo Legion Tab']},
    Amazon:{'Fire Tablet':['Fire HD 8','Fire HD 10','Fire Max 11','Fire 7','Fire HD 8 Kids','Fire HD 10 Kids']},
    Xiaomi:{'Xiaomi Pad':['Xiaomi Pad 5','Xiaomi Pad 6','Xiaomi Pad 6S Pro','Xiaomi Pad 7','Xiaomi Pad 7 Pro','Xiaomi Pad 8']},
    OnePlus:{'OnePlus Pad':['OnePlus Pad','OnePlus Pad 2','OnePlus Pad 3','OnePlus Pad Go']},
    Huawei:{'MatePad':['Huawei MatePad 11','Huawei MatePad Pro 11','Huawei MatePad Pro 12.2','Huawei MatePad SE']},
    HONOR:{'HONOR Pad':['HONOR Pad 9','HONOR Pad V9','HONOR MagicPad 2']},
    TCL:{'TCL Tab':['TCL Tab 10','TCL Tab 11','TCL NXTPAPER 11','TCL NXTPAPER 14']},
    Nokia:{'Nokia Tablet':['Nokia T10','Nokia T20','Nokia T21']}
  },
  Smartwatches:{
    Apple:{
      'Apple Watch Series':numeric(1,12).map(n=>'Apple Watch Series '+n),
      'Apple Watch Ultra':['Apple Watch Ultra','Apple Watch Ultra 2','Apple Watch Ultra 3','Apple Watch Ultra 4'],
      'Apple Watch SE':['Apple Watch SE (1st generation)','Apple Watch SE (2nd generation)','Apple Watch SE (3rd generation)']
    },
    Samsung:{
      'Galaxy Watch':['Galaxy Watch','Galaxy Watch Active','Galaxy Watch Active2','Galaxy Watch3',...numeric(4,9).flatMap(n=>['Galaxy Watch'+n,'Galaxy Watch'+n+' Classic']), 'Galaxy Watch FE','Galaxy Watch Ultra'],
      'Galaxy Fit':['Galaxy Fit2','Galaxy Fit3']
    },
    Google:{'Pixel Watch':['Pixel Watch','Pixel Watch 2','Pixel Watch 3','Pixel Watch 4']},
    Garmin:{
      'Forerunner':['Garmin Forerunner 55','Garmin Forerunner 165','Garmin Forerunner 255','Garmin Forerunner 265','Garmin Forerunner 955','Garmin Forerunner 965','Garmin Forerunner 970'],
      'Fenix':['Garmin Fenix 6','Garmin Fenix 7','Garmin Fenix 7 Pro','Garmin Fenix 8'],
      'Venu & Vivoactive':['Garmin Venu 2','Garmin Venu 3','Garmin Venu X1','Garmin vivoactive 5','Garmin vivoactive 6'],
      'Other Garmin':['Garmin Instinct 2','Garmin Instinct 3','Garmin Enduro 3','Garmin Lily 2','Garmin Approach S70']
    },
    Fitbit:{
      'Versa':['Fitbit Versa','Fitbit Versa 2','Fitbit Versa 3','Fitbit Versa 4'],
      'Sense':['Fitbit Sense','Fitbit Sense 2'],
      'Charge & Inspire':['Fitbit Charge 4','Fitbit Charge 5','Fitbit Charge 6','Fitbit Inspire 2','Fitbit Inspire 3','Fitbit Luxe']
    },
    Amazfit:{'Amazfit':['Amazfit Balance','Amazfit Balance 2','Amazfit Active','Amazfit Active 2','Amazfit GTR 3','Amazfit GTR 4','Amazfit GTS 4','Amazfit Bip 5','Amazfit Bip 6','Amazfit T-Rex 3']},
    Huawei:{'Huawei Watch':['Huawei Watch GT 3','Huawei Watch GT 4','Huawei Watch GT 5','Huawei Watch GT 6','Huawei Watch 4','Huawei Watch 5','Huawei Watch Fit 3','Huawei Watch Fit 4','Huawei Watch Ultimate']},
    Xiaomi:{'Xiaomi Watch':['Xiaomi Watch 2','Xiaomi Watch 2 Pro','Xiaomi Watch S3','Xiaomi Watch S4','Xiaomi Redmi Watch 4','Xiaomi Redmi Watch 5','Xiaomi Smart Band 8','Xiaomi Smart Band 9']},
    OnePlus:{'OnePlus Watch':['OnePlus Watch','OnePlus Watch 2','OnePlus Watch 2R','OnePlus Watch 3']},
    Motorola:{'Moto Watch':['Moto 360','Moto Watch 40','Moto Watch 70','Moto Watch 100','Moto Watch Fit']},
    Mobvoi:{'TicWatch':['TicWatch Pro 3','TicWatch Pro 5','TicWatch Pro 5 Enduro','TicWatch Atlas']},
    Suunto:{'Suunto':['Suunto Race','Suunto Race S','Suunto Run','Suunto Vertical','Suunto 9 Peak Pro']},
    Polar:{'Polar':['Polar Ignite 3','Polar Pacer','Polar Pacer Pro','Polar Vantage V3','Polar Grit X2 Pro']},
    Withings:{'ScanWatch':['Withings ScanWatch','Withings ScanWatch 2','Withings ScanWatch Light','Withings ScanWatch Nova']},
    Fossil:{'Fossil':['Fossil Gen 5','Fossil Gen 6','Fossil Hybrid HR']},
    CMF:{'CMF Watch':['CMF Watch Pro','CMF Watch Pro 2','CMF Watch 3 Pro']}
  },
  Laptops:{
    Apple:{
      'MacBook Air':['MacBook Air M1 13-inch','MacBook Air M2 13-inch','MacBook Air M2 15-inch','MacBook Air M3 13-inch','MacBook Air M3 15-inch','MacBook Air M4 13-inch','MacBook Air M4 15-inch','MacBook Air Intel 13-inch'],
      'MacBook Pro':['MacBook Pro M1 13-inch','MacBook Pro M1 Pro 14-inch','MacBook Pro M1 Max 16-inch','MacBook Pro M2 13-inch','MacBook Pro M2 Pro 14-inch','MacBook Pro M2 Max 16-inch','MacBook Pro M3 14-inch','MacBook Pro M3 Pro 14-inch','MacBook Pro M3 Max 16-inch','MacBook Pro M4 14-inch','MacBook Pro M4 Pro 14-inch','MacBook Pro M4 Max 16-inch','MacBook Pro Intel 13-inch','MacBook Pro Intel 15-inch','MacBook Pro Intel 16-inch'],
      'MacBook':['MacBook 12-inch (Retina)']
    },
    Samsung:{'Galaxy Book':['Galaxy Book','Galaxy Book2','Galaxy Book3','Galaxy Book3 Pro','Galaxy Book3 Ultra','Galaxy Book4','Galaxy Book4 Pro','Galaxy Book4 Ultra','Galaxy Book5','Galaxy Book5 Pro','Galaxy Book5 Ultra','Galaxy Book5 360']},
    Dell:{'XPS':['Dell XPS 13','Dell XPS 14','Dell XPS 15','Dell XPS 16','Dell XPS 17'],'Latitude':['Dell Latitude 3000','Dell Latitude 5000','Dell Latitude 7000'],'Inspiron':['Dell Inspiron 14','Dell Inspiron 15','Dell Inspiron 16'],'Alienware':['Dell Alienware m16','Dell Alienware x16','Dell Alienware Area-51']},
    HP:{'Spectre':['HP Spectre x360 13','HP Spectre x360 14','HP Spectre x360 16'],'Envy':['HP Envy 13','HP Envy x360 14','HP Envy x360 15'],'Pavilion':['HP Pavilion 14','HP Pavilion 15','HP Pavilion Plus 14'],'EliteBook':['HP EliteBook 840','HP EliteBook 1040'],'Omen':['HP Omen 16','HP Omen Transcend 14']},
    Lenovo:{'ThinkPad':['Lenovo ThinkPad X1 Carbon','Lenovo ThinkPad X1 Yoga','Lenovo ThinkPad T14','Lenovo ThinkPad T16','Lenovo ThinkPad E14','Lenovo ThinkPad P1'],'IdeaPad':['Lenovo IdeaPad Slim 3','Lenovo IdeaPad Slim 5','Lenovo IdeaPad Flex 5'],'Yoga':['Lenovo Yoga 7i','Lenovo Yoga 9i'],'Legion':['Lenovo Legion 5','Lenovo Legion 7','Lenovo Legion Pro 5','Lenovo Legion Pro 7']},
    Microsoft:{'Surface':['Surface Laptop 4','Surface Laptop 5','Surface Laptop 6','Surface Laptop 7','Surface Laptop Go 2','Surface Laptop Go 3','Surface Laptop Studio','Surface Laptop Studio 2']},
    ASUS:{'Zenbook':['ASUS Zenbook 14','ASUS Zenbook 14 OLED','ASUS Zenbook S 16'],'Vivobook':['ASUS Vivobook 15','ASUS Vivobook 16'],'ROG':['ASUS ROG Zephyrus G14','ASUS ROG Zephyrus G16','ASUS ROG Strix G16'],'TUF':['ASUS TUF Gaming A15','ASUS TUF Gaming F15']},
    Acer:{'Aspire':['Acer Aspire 3','Acer Aspire 5','Acer Aspire 7'],'Swift':['Acer Swift Go 14','Acer Swift X 14'],'Nitro':['Acer Nitro 5','Acer Nitro V 15'],'Predator':['Acer Predator Helios 16']},
    MSI:{'MSI':['MSI Katana 15','MSI Raider GE78','MSI Stealth 16','MSI Cyborg 15','MSI Prestige 14']},
    Razer:{'Razer Blade':['Razer Blade 14','Razer Blade 15','Razer Blade 16','Razer Blade 18']},
    LG:{'gram':['LG gram 14','LG gram 15','LG gram 16','LG gram 17','LG gram Pro 16']},
    Framework:{'Framework':['Framework Laptop 13','Framework Laptop 16']},
    Huawei:{'MateBook':['Huawei MateBook D 14','Huawei MateBook D 15','Huawei MateBook X Pro','Huawei MateBook 14']}
  },
  'Desktop Computers':{
    Apple:{'Mac':['iMac 24-inch (M1)','iMac 24-inch (M3)','iMac 24-inch (M4)','Mac mini M1','Mac mini M2','Mac mini M2 Pro','Mac mini M4','Mac mini M4 Pro','Mac Studio M1 Max','Mac Studio M2 Ultra','Mac Studio M4 Max','Mac Pro 2019','Mac Pro 2023']},
    Dell:{'Dell':['Dell OptiPlex Micro','Dell OptiPlex SFF','Dell OptiPlex Tower','Dell Precision Workstation','Dell Inspiron Desktop','Dell XPS Desktop','Alienware Aurora']},
    HP:{'HP':['HP EliteDesk Mini','HP EliteDesk SFF','HP ProDesk','HP Pavilion Desktop','HP Omen Desktop','HP Z Workstation']},
    Lenovo:{'Lenovo':['ThinkCentre Tiny','ThinkCentre M Series','ThinkStation','IdeaCentre','Legion Tower']},
    ASUS:{'ASUS':['ASUS ExpertCenter','ASUS ROG Desktop','ASUS Mini PC','ASUS NUC']},
    Acer:{'Acer':['Acer Aspire Desktop','Acer Veriton','Acer Predator Orion','Acer Nitro 50']},
    Microsoft:{'Surface':['Surface Studio','Surface Studio 2','Surface Studio 2+']}
  },
  'Audio & Headphones':{
    Apple:{'AirPods':['AirPods (1st generation)','AirPods (2nd generation)','AirPods (3rd generation)','AirPods 4','AirPods 5','AirPods Pro (1st generation)','AirPods Pro (2nd generation)','AirPods Pro 3','AirPods Max']},
    Beats:{'Beats':['Beats Studio Pro','Beats Solo 4','Beats Studio Buds','Beats Studio Buds+','Beats Fit Pro','Beats Powerbeats Pro']},
    Samsung:{'Galaxy Buds':['Galaxy Buds','Galaxy Buds+','Galaxy Buds2','Galaxy Buds2 Pro','Galaxy Buds3','Galaxy Buds3 Pro','Galaxy Buds4','Galaxy Buds4 Pro','Galaxy Buds FE']},
    Sony:{'Sony':['Sony WH-1000XM4','Sony WH-1000XM5','Sony WH-1000XM6','Sony WF-1000XM4','Sony WF-1000XM5','Sony LinkBuds']},
    Bose:{'Bose':['Bose QuietComfort Headphones','Bose QuietComfort Ultra Headphones','Bose QuietComfort Earbuds','Bose QuietComfort Ultra Earbuds','Bose SoundLink']},
    JBL:{'JBL':['JBL Tune 510BT','JBL Tune 720BT','JBL Live 660NC','JBL Live Pro 2','JBL Tour Pro 2','JBL Charge 5','JBL Flip 6']},
    Anker:{'Soundcore':['Soundcore Liberty 4','Soundcore Liberty 4 NC','Soundcore Space One','Soundcore Q45','Soundcore Motion Boom']},
    Sennheiser:{'Sennheiser':['Momentum 4 Wireless','Momentum True Wireless 4','Accentum Wireless']},
    Google:{'Pixel Buds':['Pixel Buds A-Series','Pixel Buds Pro','Pixel Buds Pro 2']},
    Nothing:{'Nothing Ear':['Nothing Ear','Nothing Ear (a)','Nothing Ear (open)','CMF Buds Pro 2']},
    OnePlus:{'OnePlus Buds':['OnePlus Buds 2','OnePlus Buds 3','OnePlus Buds Pro 2','OnePlus Buds Pro 3']}
  },
  'Gaming Consoles':{
    Sony:{'PlayStation':['PlayStation 4','PlayStation 4 Slim','PlayStation 4 Pro','PlayStation 5','PlayStation 5 Digital','PlayStation 5 Slim','PlayStation 5 Pro','PlayStation Portal']},
    Microsoft:{'Xbox':['Xbox One','Xbox One S','Xbox One X','Xbox Series S','Xbox Series X']},
    Nintendo:{'Nintendo':['Nintendo Switch','Nintendo Switch Lite','Nintendo Switch OLED','Nintendo Switch 2','Nintendo 3DS','Nintendo 2DS','Nintendo Wii','Nintendo Wii U']},
    Valve:{'Steam Deck':['Steam Deck LCD','Steam Deck OLED']},
    ASUS:{'ROG Ally':['ROG Ally','ROG Ally X','ROG Xbox Ally','ROG Xbox Ally X']},
    Lenovo:{'Legion Go':['Lenovo Legion Go','Lenovo Legion Go S']},
    Meta:{'Meta Quest':['Meta Quest 2','Meta Quest 3','Meta Quest 3S','Meta Quest Pro']}
  }
};
const EXTRA_BRANDS={
  Phones:['Apple','Samsung','Google','Motorola','OnePlus','Xiaomi','Redmi','POCO','OPPO','vivo','realme','Nothing','Sony','ASUS','Nokia / HMD','HONOR','Huawei','TCL','ZTE','LG','HTC','Lenovo','TECNO','Infinix','BlackBerry','Fairphone'],
  Tablets:['Apple','Samsung','Google','Microsoft','Lenovo','Amazon','Xiaomi','OnePlus','Huawei','HONOR','TCL','Nokia','ASUS','Acer'],
  Smartwatches:['Apple','Samsung','Google','Garmin','Fitbit','Amazfit','Huawei','Xiaomi','OnePlus','Motorola','Mobvoi','Suunto','Polar','Withings','Fossil','CMF','Casio','Coros'],
  Laptops:['Apple','Samsung','Dell','HP','Lenovo','Microsoft','ASUS','Acer','MSI','Razer','LG','Framework','Huawei','HONOR','Google','Toshiba','Gigabyte'],
  'Desktop Computers':['Apple','Dell','HP','Lenovo','ASUS','Acer','Microsoft','MSI','Intel','NZXT','Custom Built'],
  'Audio & Headphones':['Apple','Beats','Samsung','Sony','Bose','JBL','Anker','Sennheiser','Google','Nothing','OnePlus','Jabra','Skullcandy','Audio-Technica','Marshall','Shokz','JLab'],
  'Gaming Consoles':['Sony','Microsoft','Nintendo','Valve','ASUS','Lenovo','Meta','Logitech','Anbernic','AYANEO','MSI'],
  Accessories:['Apple','Samsung','Anker','Belkin','Spigen','OtterBox','UAG','UGREEN','ESR','Baseus','Logitech','Amazon Basics','Generic'],
  Parts:['Apple','Samsung','Google','Motorola','Sony','Microsoft','Nintendo','Generic'],
  Networking:['TP-Link','Netgear','Ubiquiti','ASUS','Cisco','Linksys','Eero','Google','Arris','Motorola','Generic'],
  Other:['Apple','Samsung','Google','Sony','Microsoft','Lenovo','ASUS','Generic']
};
const GENERIC_FAMILIES={
  Accessories:['Cases & Covers','Screen Protectors','Chargers & Cables','Power Banks','Car Accessories','Adapters & Hubs','Keyboards & Mice','Stands & Mounts','Stylus Pens','Storage & Memory','Other Accessories'],
  Parts:['Screens & Displays','Batteries','Charging Ports','Cameras','Back Glass','Housings & Frames','Speakers & Microphones','Buttons & Flex Cables','Motherboards & ICs','Other Replacement Parts'],
  Networking:['Wi-Fi Routers','Wi-Fi Mesh Systems','Modems','Network Switches','Access Points','Range Extenders','Ethernet Adapters','Networking Cables','Other Networking Items'],
  Other:['General Merchandise','Electronics','Tools','Gift Cards','Miscellaneous']
};
const CATEGORY_PRESETS=CATEGORIES.map(v=>({value:v,label:({'Phones':'📱 Phones','Tablets':'▣ Tablets / iPads','Smartwatches':'⌚ Smartwatches / Fitness','Laptops':'💻 Laptops / MacBooks','Desktop Computers':'🖥️ Desktop Computers','Audio & Headphones':'🎧 Audio / Headphones','Gaming Consoles':'🎮 Gaming / Consoles','Accessories':'🔌 Accessories','Parts':'🧰 Repair Parts','Networking':'📶 Networking','Other':'📦 Other'})[v]}));
const CONDITIONS=[
  ['New - Factory Sealed','New · Factory Sealed'],
  ['New - Open Box','New · Open Box'],
  ['Like New','Like New · No noticeable wear'],
  ['Pre-Owned - Excellent','Pre-Owned · Excellent'],
  ['Pre-Owned - Good','Pre-Owned · Good'],
  ['Pre-Owned - Fair','Pre-Owned · Fair'],
  ['Pre-Owned - Poor','Pre-Owned · Poor'],
  ['Refurbished - Grade A','Refurbished · Grade A'],
  ['Refurbished - Grade B','Refurbished · Grade B'],
  ['Refurbished - Grade C','Refurbished · Grade C'],
  ['For Parts / Not Working','For Parts / Not Working'],
  ['As-Is / Untested','As-Is / Untested'],
  ['Other / Custom','Other · Custom Condition']
];
const $=pick;
const SELECT_CUSTOM='__custom__';
let lastAutoTitle='';
let isUpdating=false;
let catalogModelOptions=[];
function fieldOption(value,label){const option=document.createElement('option');option.value=value;option.textContent=label??value;return option}
function replaceOptions(id,choices,placeholder){
 const el=$(id);if(!el)return;
 const frag=document.createDocumentFragment();
 frag.append(fieldOption('',placeholder));
 for(const row of choices){
   frag.append(Array.isArray(row)?fieldOption(row[0],row[1]):fieldOption(row));
 }
 el.replaceChildren(frag);
 el.value='';
}
function selectWithLegacy(id,value){
 const el=$(id);if(!el)return;
 let val=String(value??'');
 if(!val){el.value='';return}
 if(!Array.from(el.options).some(opt=>opt.value===val)){
   const old=fieldOption(val,val+' (saved previously)');
   el.appendChild(old);
 }
 el.value=val;
}
function cleanName(value){return String(value||'').trim().replace(/\s+/g,' ')}
function getData(){
 const category=$('productCategory')?.value||'';
 const selectedBrand=$('productBrand')?.value||'';
 const brand=selectedBrand===OTHER?cleanName($('productCustomBrand')?.value):selectedBrand;
 const series=$('productSeries')?.value||'';
 const choice=$('productModelPicker')?.value||'';
 const custom=cleanName($('productCustomModel')?.value);
 const model=choice===SELECT_CUSTOM?custom:choice;
 const capacity=$('productCapacity')?.value||'';
 const color=cleanName($('productColor')?.value);
 return {category,brand,series,model,capacity,color,custom};
}
function generateTitle(){
 const data=getData();
 if(!data.model)return '';
 let out=data.model;
 if(data.brand && !out.toLowerCase().startsWith(data.brand.toLowerCase()) && !(['Apple'].includes(data.brand)&&(out.startsWith('iPhone')||out.startsWith('iPad')||out.startsWith('MacBook')||out.startsWith('iMac')||out.startsWith('Mac ')||out.startsWith('AirPods')||out.startsWith('Apple Watch')))){
   out=data.brand+' '+out;
 }
 if(data.capacity && !out.toLowerCase().includes(data.capacity.toLowerCase()))out+=' · '+data.capacity;
 if(data.color && !out.toLowerCase().includes(data.color.toLowerCase()))out+=' · '+data.color;
 return out;
}
function clearGeneratedTitle(){
 const title=$('productTitle');
 if(title&&lastAutoTitle&&title.value===lastAutoTitle)title.value='';
 lastAutoTitle='';
}
function fillTitle(force=false){
 const title=$('productTitle'),next=generateTitle();
 if(!title)return;
 if(next && (force||!title.value.trim()||title.value===lastAutoTitle)){
   title.value=next.slice(0,160);
   title.dispatchEvent(new Event('change',{bubbles:true}));
   lastAutoTitle=title.value;
 }
 const preview=$('productCatalogPreview');
 if(preview){
   preview.textContent=next||'Choose a brand and model to preview the suggested item name. You can always type your own title.';
 }
}
function brandChanged(){
 if(isUpdating)return;
 clearGeneratedTitle();
 const cat=$('productCategory').value, brand=$('productBrand').value;
 const custom=brand===OTHER;
 $('productCustomBrandWrap').hidden=!custom;
 $('productCustomBrand').required=custom;
 if(!custom)$('productCustomBrand').value='';
 const families=DEVICES[cat]?.[brand]||{};
 const all=unique(Object.keys(families).concat(GENERIC_FAMILIES[cat]||[]));
 replaceOptions('productSeries',all,'Select family / series');
 if(!all.length && brand)selectWithLegacy('productSeries','Other / Custom');
 const series=$('productSeries');if(series && !series.value && all.length===1)series.value=all[0];
 seriesChanged();
}
function seriesChanged(){
 if(isUpdating)return;
 clearGeneratedTitle();
 const cat=$('productCategory').value,brand=$('productBrand').value,series=$('productSeries').value;
 const models=unique(DEVICES[cat]?.[brand]?.[series]||[]);
 catalogModelOptions=models;
 $('productModelSearch').value='';
 updateModelOptions('');
 if(!models.length && brand){$('productModelPicker').value=SELECT_CUSTOM;}
 productModelChanged();
}
function categoryChanged(){
 if(isUpdating)return;
 clearGeneratedTitle();
 const category=$('productCategory').value;
 const brands=unique((EXTRA_BRANDS[category]||[]).concat(Object.keys(DEVICES[category]||{})));
 replaceOptions('productBrand',[...brands.map(b=>[b,b]),[OTHER,'Other / Unlisted Brand']],'Choose manufacturer / brand');
 $('productCustomBrand').value='';
 $('productCustomBrandWrap').hidden=true;
 $('productCustomBrand').required=false;
 catalogModelOptions=[];
 replaceOptions('productSeries',[],'Choose a brand first');
 replaceOptions('productModelPicker',[[SELECT_CUSTOM,'✏️ Model not listed? Type your own']],'Select a model');
 $('productCustomModel').value='';
 $('productCustomModelWrap').hidden=true;
 $('productModelSearch').value='';
 $('productModelSearch').disabled=true;
 updateHelp();
 fillTitle();
}
function updateHelp(){
 const text=$('productCatalogHelp');if(!text)return;
 const cat=$('productCategory').value,brands=EXTRA_BRANDS[cat]||[];
 text.textContent=cat==='Phones'?'Apple iPhone, Samsung Galaxy, Google Pixel, Motorola, OnePlus, Xiaomi and many more Android lines.':cat==='Smartwatches'?'Apple Watch, Samsung Galaxy Watch, Pixel Watch, Garmin, Fitbit, Amazfit and other smartwatch brands.':cat==='Tablets'?'Apple iPad, Samsung Galaxy Tab, Amazon Fire, Pixel Tablet, Surface, Lenovo and more.':cat==='Accessories'||cat==='Parts'||cat==='Networking'?'Choose a type, then enter the specific product model, part number or accessory name.':'Choose from '+brands.length+' major brands, or select Other / Unlisted and type your exact model.';
}
function productModelChanged(){
 if(isUpdating)return;
 clearGeneratedTitle();
 const picker=$('productModelPicker'),custom=picker.value===SELECT_CUSTOM;
 $('productCustomModelWrap').hidden=!custom;
 $('productCustomModel').required=custom;
 $('productModelSearch').disabled=picker.options.length<=2;
 if(custom)$('productCustomModel').focus();
 fillTitle();
}
function capacityChanged(){fillTitle()}
function updateModelOptions(filter){
 const picker=$('productModelPicker');
 const selected=picker.value;
 const matching=catalogModelOptions.filter(v=>v.toLowerCase().includes(filter.toLowerCase()));
 const shown=selected && selected!==SELECT_CUSTOM && !matching.includes(selected)?[selected,...matching]:matching;
 const frag=document.createDocumentFragment();
 frag.append(fieldOption('','Select a model or choose custom'));
 for(const item of shown)frag.append(fieldOption(item,item));
 frag.append(fieldOption(SELECT_CUSTOM,'✏️ Model not listed? Type your own'));
 picker.replaceChildren(frag);
 if(selected && (selected===SELECT_CUSTOM || shown.includes(selected)))picker.value=selected;
 $('productModelMessage').textContent=matching.length?matching.length+' available model(s)'+(filter?' matching your search':'')+'.':'No preset models match. Select “Model not listed?” and type it yourself.';
}
function searchModels(){updateModelOptions($('productModelSearch').value.trim())}
function conditionChanged(){
 const show=$('productCondition').value==='Other / Custom';
 $('productConditionCustomWrap').hidden=!show;
 $('productConditionCustom').required=show;
 if(show && document.activeElement===$('productCondition'))$('productConditionCustom').focus();
}
function readCondition(){
 const value=$('productCondition').value;
 if(value==='Other / Custom')return cleanName($('productConditionCustom').value);
 return value;
}
function validate(){
 if($('productBrand').value===OTHER&&!cleanName($('productCustomBrand').value)){
   $('productCustomBrand').focus();return 'Enter the brand or manufacturer name.';
 }
 if($('productModelPicker')?.value===SELECT_CUSTOM&&!cleanName($('productCustomModel').value)){
   $('productCustomModel').focus();return 'Please enter your custom model name.';
 }
 if($('productCondition')?.value==='Other / Custom'&&!cleanName($('productConditionCustom').value)){
   $('productConditionCustom').focus();return 'Please enter the condition description.';
 }
 return '';
}
function loadProduct(p){
 lastAutoTitle='';
 const cat=String(p.category||'Phones');
 selectWithLegacy('productCategory',cat);
 categoryChanged();
 const brand=cleanName(p.brand);
 if(brand){
   const known=Array.from($('productBrand').options).some(opt=>opt.value===brand);
   $('productBrand').value=known?brand:OTHER;
   if(!known)$('productCustomBrand').value=brand;
   brandChanged();
 }
 const family=cleanName(p.device_family);
 if(family){selectWithLegacy('productSeries',family);seriesChanged()}
 const model=cleanName(p.model);
 if(model){
   const preset=Array.from($('productModelPicker').options).some(opt=>opt.value===model);
   $('productModelPicker').value=preset?model:SELECT_CUSTOM;
   if(!preset)$('productCustomModel').value=model;
   productModelChanged();
 }
 $('productCapacity').value=p.capacity||'';
 $('productColor').value=p.color||'';
 const condition=String(p.condition||'');
 if(condition){
   const known=CONDITIONS.some(pair=>pair[0]===condition);
   if(known)selectWithLegacy('productCondition',condition);
   else{
     $('productCondition').value='Other / Custom';
     $('productConditionCustom').value=condition;
   }
 }else $('productCondition').value='';
 conditionChanged(false);
 $('productTitle').value=p.title||'';
 lastAutoTitle='';
 updateHelp();
 fillTitle();
}
function reset(){
 isUpdating=true;
 lastAutoTitle='';
 selectWithLegacy('productCategory','Phones');
 $('productModelSearch').value='';
 $('productCapacity').value='';
 $('productColor').value='';
 $('productCustomModel').value='';
 $('productCustomBrand').value='';
 $('productConditionCustom').value='';
 $('productCondition').value='';
 isUpdating=false;
 categoryChanged();
 $('productConditionCustomWrap').hidden=true;
 $('productConditionCustom').required=false;
 $('productModelMessage').textContent='';
 fillTitle();
}
function initialize(){
 if(!$('productForm')||!$('productCategory')||!$('productBrand'))return;
 const cat=$('productCategory');
 const catFrag=document.createDocumentFragment();
 for(const c of CATEGORY_PRESETS)catFrag.append(fieldOption(c.value,c.label));
 cat.replaceChildren(catFrag);
 const cond=$('productCondition');
 const condFrag=document.createDocumentFragment();
 condFrag.append(fieldOption('','Select an item condition'));
 for(const c of CONDITIONS)condFrag.append(fieldOption(c[0],c[1]));
 cond.replaceChildren(condFrag);
 cat.addEventListener('change',categoryChanged);
 $('productBrand').addEventListener('change',brandChanged);
 $('productCustomBrand').addEventListener('input',fillTitle);
 $('productSeries').addEventListener('change',seriesChanged);
 $('productModelPicker').addEventListener('change',productModelChanged);
 $('productCustomModel').addEventListener('input',fillTitle);
 $('productModelSearch').addEventListener('input',searchModels);
 $('productCapacity').addEventListener('change',capacityChanged);
 $('productColor').addEventListener('input',capacityChanged);
 cond.addEventListener('change',conditionChanged);
 $('productTitle').addEventListener('input',()=>{if($('productTitle').value!==lastAutoTitle)lastAutoTitle=''});
 reset();
}
window.AJDDeviceCatalog={initialize,reset,loadProduct,readCondition,validate,fillTitle,categoryChanged,getData};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initialize);
else initialize();
})();
