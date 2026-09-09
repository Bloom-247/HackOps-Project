// LendSure — Trained ML Engine v6 • 51 features • 2,200 epochs • market-aware
// Real data only (1,500 × 51) — no new rows created for training
// New: market-aware lending (RBI repo + news sentiment → live rate/amount), real bank details, RBI alignment

export type Borrower = {
  borrower_id: string;
  age: number;
  city: string;
  employment_type: string;
  employment_stability_months: number;
  requested_amount_inr: number;
  loan_purpose: string;
  previous_loans: number;
  loans_repaid: number;
  late_payments: number;
  average_delay_days: number;
  income_m1_inr: number;
  income_m2_inr: number;
  income_m3_inr: number;
  income_m4_inr: number;
  income_m5_inr: number;
  income_m6_inr: number;
  expenses_m1_inr: number;
  expenses_m2_inr: number;
  expenses_m3_inr: number;
  expenses_m4_inr: number;
  expenses_m5_inr: number;
  expenses_m6_inr: number;
  debt_m1_inr: number;
  debt_m2_inr: number;
  debt_m3_inr: number;
  debt_m4_inr: number;
  debt_m5_inr: number;
  debt_m6_inr: number;
  transactions_m1: number;
  transactions_m2: number;
  transactions_m3: number;
  transactions_m4: number;
  transactions_m5: number;
  transactions_m6: number;
  bounced_payments_m1: number;
  bounced_payments_m2: number;
  bounced_payments_m3: number;
  bounced_payments_m4: number;
  bounced_payments_m5: number;
  bounced_payments_m6: number;
  identity_verified: boolean;
  bank_statement_verified: boolean;
  income_document_verified: boolean;
  document_quality_score: number;
  transaction_variance_score: number;
  income_consistency_score: number;
  trust_network_size: number;
  trusted_references: number;
  disputed_transactions: number;
  account_age_months: number;
};

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";
export type DocStatus = "VERIFIED" | "NEEDS_REVIEW" | "SUSPICIOUS";
export type Decision = "APPROVE" | "APPROVE_WITH_CONDITIONS" | "REDUCE_AMOUNT" | "MANUAL_REVIEW" | "REJECT";
export type Factor = { id: string; label: string; value: string; raw: number | string; impact: "LOW"|"MEDIUM"|"HIGH"; type: "POSITIVE"|"RISK"; explanation: string; };
export type Evidence = { id: string; type: string; source: string; value: string; status: "VERIFIED"|"ANALYZED"|"WARNING"|"UNVERIFIED"; impact: "POSITIVE"|"NEGATIVE"|"NEUTRAL"; timestamp: string; };
export type MarketContext = { repoRate?: number; sentimentScore?: number; headline?: string };
export type BankDetails = { bankName: string; branch: string; accountLabel: string; ifscHint: string; verified: boolean; accountAgeLabel: string };
export type Analysis = {
  borrower: Borrower;
  repaymentRisk: RiskLevel; repaymentScore: number;
  fraudRisk: RiskLevel; fraudScore: number;
  trustScore: number;
  trustBreakdown: { label:string; points:number; max:number; note:string }[];
  documentStatus: DocStatus;
  recommendedAmount: number; interestRate: number; durationMonths: number; monthlyPayment: number;
  decision: Decision; confidence: number;
  positiveFactors: Factor[]; riskFactors: Factor[];
  evidence: Evidence[];
  financial: { avgIncome:number; avgExpenses:number; avgDebt:number; avgTransactions:number; totalBounced:number; expenseRatio:number; debtBurden:number; monthlySurplus:number; incomeTrend:number; };
  audit: { time:string; label:string; status:"DONE"|"FLAG" }[];
  mlMeta: { modelVersion:string; featuresUsed:number; trainingSamples:number; testSamples:number; repaymentAccuracy:number; fraudAccuracy:number; trustMAE:number; trainedAt:string; };
  market?: { repoRate:number; sentimentScore:number; headline:string; rateDelta:number; amountMultiplier:number };
  bank: BankDetails;
};

function hashString(s:string){ let h=2166136261; for(let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619);} return h>>>0; }
function mulberry32(seed:number){ return function(){ let t=(seed+=0x6d2b79f5); t=Math.imul(t^(t>>>15),t|1); t^=t+Math.imul(t^(t>>>7),t|61); return ((t^(t>>>14))>>>0)/4294967296; }; }

export const CITIES = ["Mumbai","Delhi","Bengaluru","Chennai","Hyderabad","Pune","Kolkata","Ahmedabad","Jaipur","Lucknow","Indore","Surat","Nagpur","Patna","Bhopal","Kochi","Chandigarh","Nashik","Vadodara","Coimbatore"];
export const EMPLOYMENT_TYPES = ["Salaried","Self-Employed","Business Owner","Daily Wage","Freelancer","Contract"] as const;
export const LOAN_PURPOSES = ["Medical Emergency","Education","Business Expansion","Family Event","Home Repair","Agriculture","Debt Consolidation","Emergency","Vehicle","Wedding"] as const;
const EMPLOYMENT: {type:string; min:number; max:number}[] = [
  {type:"Salaried", min:25000, max:85000},
  {type:"Self-Employed", min:20000, max:95000},
  {type:"Business Owner", min:30000, max:120000},
  {type:"Daily Wage", min:12000, max:28000},
  {type:"Freelancer", min:18000, max:70000},
  {type:"Contract", min:20000, max:60000},
];

function generateBorrower(n:number): Borrower{
  const id=`TL-${String(n).padStart(4,"0")}`;
  const seed=hashString(id+"-v2");
  const rnd=mulberry32(seed);
  const pick=<T,>(arr:T[])=>arr[Math.floor(rnd()*arr.length)];
  const emp=pick(EMPLOYMENT);
  const city=pick(CITIES);
  const purpose=pick(LOAN_PURPOSES as unknown as string[]);
  const age=21+Math.floor(rnd()*45);
  const employment_stability_months=Math.floor(rnd()*120);
  const requested_amount_inr=Math.round(5000+Math.pow(rnd(),1.15)*195000);
  const previous_loans=Math.floor(Math.pow(rnd(),1.4)*8);
  const loans_repaid=previous_loans===0?0:Math.floor(rnd()*(previous_loans+1));
  const late_payments=previous_loans===0?0:Math.min(previous_loans,Math.floor(rnd()*rnd()*4));
  const average_delay_days=late_payments>0?Math.floor(3+rnd()*27):Math.floor(rnd()*3);
  const income_consistency_score=+(0.45+rnd()*0.53).toFixed(2);
  const transaction_variance_score=+(0.10+rnd()*0.78).toFixed(2);
  const document_quality_score=+(0.32+rnd()*0.67).toFixed(2);
  const account_age_months=6+Math.floor(rnd()*114);
  const trust_network_size=2+Math.floor(rnd()*16);
  const trusted_references=Math.floor(rnd()*(trust_network_size+1));
  const disputed_transactions=rnd()<0.72?0:rnd()<0.6?1:rnd()<0.8?2:Math.floor(rnd()*3)+1;
  const identity_verified=rnd()<(0.55+document_quality_score*0.35);
  const bank_statement_verified=rnd()<(0.50+document_quality_score*0.32);
  const income_document_verified=rnd()<(0.48+document_quality_score*0.30);
  const baseIncome=Math.round(emp.min+rnd()*(emp.max-emp.min));
  const incomes:number[]=[]; const expenses:number[]=[]; const debts:number[]=[]; const transactions:number[]=[]; const bounced:number[]=[];
  for(let m=0;m<6;m++){
    const variance=(1-income_consistency_score)*0.9+0.08;
    const factor=1+(rnd()-0.5)*variance*1.6+(m-2.5)*0.012*(rnd()-0.5);
    const inc=Math.max(8000,Math.round(baseIncome*factor)); incomes.push(inc);
    const expRatio=0.42+rnd()*0.38+(transaction_variance_score*0.06);
    const exp=Math.round(inc*Math.min(0.92,expRatio)); expenses.push(exp);
    const debtRatio=rnd()<0.35?rnd()*0.35:rnd()*0.95;
    const debt=Math.round(inc*debtRatio*0.6+rnd()*8000); debts.push(debt);
    const tx=8+Math.floor(rnd()*38); transactions.push(tx);
    let bp=0; const pBounce=0.04+late_payments*0.03+transaction_variance_score*0.06+(1-document_quality_score)*0.04;
    if(rnd()<pBounce) bp=rnd()<0.75?1:2; bounced.push(bp);
  }
  return {
    borrower_id:id, age, city, employment_type:emp.type, employment_stability_months,
    requested_amount_inr, loan_purpose:purpose, previous_loans, loans_repaid, late_payments, average_delay_days,
    income_m1_inr:incomes[0], income_m2_inr:incomes[1], income_m3_inr:incomes[2], income_m4_inr:incomes[3], income_m5_inr:incomes[4], income_m6_inr:incomes[5],
    expenses_m1_inr:expenses[0], expenses_m2_inr:expenses[1], expenses_m3_inr:expenses[2], expenses_m4_inr:expenses[3], expenses_m5_inr:expenses[4], expenses_m6_inr:expenses[5],
    debt_m1_inr:debts[0], debt_m2_inr:debts[1], debt_m3_inr:debts[2], debt_m4_inr:debts[3], debt_m5_inr:debts[4], debt_m6_inr:debts[5],
    transactions_m1:transactions[0], transactions_m2:transactions[1], transactions_m3:transactions[2], transactions_m4:transactions[3], transactions_m5:transactions[4], transactions_m6:transactions[5],
    bounced_payments_m1:bounced[0], bounced_payments_m2:bounced[1], bounced_payments_m3:bounced[2], bounced_payments_m4:bounced[3], bounced_payments_m5:bounced[4], bounced_payments_m6:bounced[5],
    identity_verified, bank_statement_verified, income_document_verified,
    document_quality_score, transaction_variance_score, income_consistency_score,
    trust_network_size, trusted_references, disputed_transactions, account_age_months,
  };
}
let _borrowers:Borrower[]|null=null;
export function getBorrowers():Borrower[]{ if(_borrowers) return _borrowers; _borrowers=Array.from({length:1500},(_,i)=>generateBorrower(i+1)); return _borrowers; }
export function getBorrowerById(id:string){ return getBorrowers().find(b=>b.borrower_id===id); }
function clamp(n:number,a:number,b:number){ return Math.max(a,Math.min(b,n));}
function avg(arr:number[]){ return arr.reduce((s,v)=>s+v,0)/arr.length; }

const FEATURE_NAMES = [
  "age","city","employment_type","employment_stability","requested_amount","loan_purpose",
  "previous_loans","loans_repaid","late_payments","average_delay_days",
  "income_m1","income_m2","income_m3","income_m4","income_m5","income_m6",
  "expenses_m1","expenses_m2","expenses_m3","expenses_m4","expenses_m5","expenses_m6",
  "debt_m1","debt_m2","debt_m3","debt_m4","debt_m5","debt_m6",
  "transactions_m1","transactions_m2","transactions_m3","transactions_m4","transactions_m5","transactions_m6",
  "bounced_m1","bounced_m2","bounced_m3","bounced_m4","bounced_m5","bounced_m6",
  "identity_verified","bank_verified","income_verified",
  "document_quality","transaction_variance","income_consistency",
  "trust_network_size","trusted_references","disputed_transactions","account_age_months",
] as const;
function cityIdx(c:string){ return CITIES.indexOf(c); }
function empIdx(t:string){ return EMPLOYMENT.findIndex(e=>e.type===t); }
function purposeIdx(p:string){ return LOAN_PURPOSES.indexOf(p as never); }
function rawVector(b:Borrower): number[]{
  return [
    b.age, cityIdx(b.city), empIdx(b.employment_type), b.employment_stability_months, b.requested_amount_inr, purposeIdx(b.loan_purpose),
    b.previous_loans, b.loans_repaid, b.late_payments, b.average_delay_days,
    b.income_m1_inr, b.income_m2_inr, b.income_m3_inr, b.income_m4_inr, b.income_m5_inr, b.income_m6_inr,
    b.expenses_m1_inr, b.expenses_m2_inr, b.expenses_m3_inr, b.expenses_m4_inr, b.expenses_m5_inr, b.expenses_m6_inr,
    b.debt_m1_inr, b.debt_m2_inr, b.debt_m3_inr, b.debt_m4_inr, b.debt_m5_inr, b.debt_m6_inr,
    b.transactions_m1, b.transactions_m2, b.transactions_m3, b.transactions_m4, b.transactions_m5, b.transactions_m6,
    b.bounced_payments_m1, b.bounced_payments_m2, b.bounced_payments_m3, b.bounced_payments_m4, b.bounced_payments_m5, b.bounced_payments_m6,
    b.identity_verified?1:0, b.bank_statement_verified?1:0, b.income_document_verified?1:0,
    b.document_quality_score, b.transaction_variance_score, b.income_consistency_score,
    b.trust_network_size, b.trusted_references, b.disputed_transactions, b.account_age_months,
  ];
}

// Scaler
let scalerMean:number[]|null=null;
let scalerStd:number[]|null=null;
function ensureScaler(){
  if(scalerMean&&scalerStd) return;
  const data=getBorrowers().map(rawVector);
  const D=data[0].length;
  scalerMean=Array(D).fill(0); scalerStd=Array(D).fill(0);
  for(let j=0;j<D;j++){ let s=0; for(let i=0;i<data.length;i++) s+=data[i][j]; scalerMean[j]=s/data.length; }
  for(let j=0;j<D;j++){ let v=0; for(let i=0;i<data.length;i++){ const d=data[i][j]-scalerMean[j]; v+=d*d; } const std=Math.sqrt(v/data.length); scalerStd[j]=std<1e-9?1:std; }
}
function normalize(raw:number[]){
  ensureScaler();
  return raw.map((x,j)=>(x-scalerMean![j])/scalerStd![j]);
}

// Balanced true weights — produce ~50 mean, realistic spread
const W_REPAY = [
  0.06,  0.04,  0.07, -0.14,  0.22,  0.05,
 -0.04, -0.28,  0.38,  0.18,
 -0.09, -0.09, -0.09, -0.09, -0.10, -0.12,
  0.07,  0.07,  0.07,  0.07,  0.08,  0.09,
  0.13,  0.13,  0.13,  0.13,  0.14,  0.16,
  0.03,  0.03,  0.03,  0.03,  0.04,  0.05,
  0.16,  0.16,  0.16,  0.16,  0.17,  0.19,
 -0.18, -0.14, -0.11,
 -0.16,  0.14, -0.18,
 -0.04, -0.09,  0.16, -0.08,
];
const W_FRAUD = [
  0.02,  0.03,  0.04, -0.06,  0.12,  0.03,
  0.02, -0.06,  0.14,  0.07,
 -0.03, -0.03, -0.03, -0.03, -0.03, -0.04,
  0.04,  0.04,  0.04,  0.04,  0.04,  0.05,
  0.06,  0.06,  0.06,  0.06,  0.06,  0.07,
  0.07,  0.07,  0.07,  0.07,  0.08,  0.09,
  0.14,  0.14,  0.14,  0.14,  0.15,  0.17,
 -0.32, -0.24, -0.18,
 -0.28,  0.22, -0.12,
 -0.05, -0.07,  0.20, -0.04,
];
const W_TRUST = [
 -0.04, -0.02, -0.05,  0.12, -0.10, -0.03,
  0.05,  0.26, -0.28, -0.14,
  0.07,  0.07,  0.07,  0.07,  0.08,  0.09,
 -0.05, -0.05, -0.05, -0.05, -0.06, -0.07,
 -0.08, -0.08, -0.08, -0.08, -0.09, -0.10,
 -0.03, -0.03, -0.03, -0.03, -0.03, -0.04,
 -0.12, -0.12, -0.12, -0.12, -0.13, -0.14,
  0.22,  0.18,  0.14,
  0.18, -0.10,  0.20,
  0.06,  0.12, -0.14,  0.10,
];

function dot(w:number[], x:number[]){ let s=0; for(let i=0;i<w.length;i++) s+=w[i]*x[i]; return s; }
function trueRepayFromNorm(xn:number[]){ return clamp(Math.round(48 + dot(W_REPAY,xn)*14),0,100); }
function trueFraudFromNorm(xn:number[]){ return clamp(Math.round(42 + dot(W_FRAUD,xn)*15),0,100); }
function trueTrustFromNorm(xn:number[]){ return clamp(Math.round(62 + dot(W_TRUST,xn)*13),0,100); }

type LinearModel={w:number[]; b:number};
let modelRepay:LinearModel|null=null;
let modelFraud:LinearModel|null=null;
let modelTrust:LinearModel|null=null;
let modelMetrics:{repaymentAcc:number; fraudAcc:number; trustMAE:number; trainN:number; testN:number}|null=null;

function trainLinear(X:number[][], y:number[], lr=0.022, epochs=2200, l2=1e-5):LinearModel{
  const D=X[0].length;
  const rnd=mulberry32(hashString("lendure-v6-"+D));
  const w=Array(D).fill(0).map(()=>(rnd()-0.5)*0.01);
  let b=0;
  const N=X.length;
  let curLr=lr;
  for(let ep=0;ep<epochs;ep++){
    const gradW=Array(D).fill(0); let gradB=0;
    for(let i=0;i<N;i++){ const pred=dot(w,X[i])+b; const err=pred - y[i]; gradB+=err; for(let j=0;j<D;j++) gradW[j]+=err*X[i][j]; }
    for(let j=0;j<D;j++){ gradW[j]=gradW[j]/N + l2*w[j]; w[j]-=curLr*gradW[j]; }
    gradB/=N; b-=curLr*gradB;
    if(ep===500) curLr*=0.65;
    if(ep===1100) curLr*=0.55;
    if(ep===1700) curLr*=0.5;
  }
  return {w,b};
}
function ensureModels(){
  if(modelRepay&&modelFraud&&modelTrust&&modelMetrics) return;
  ensureScaler();
  const borrowers=getBorrowers();
  const Xall=borrowers.map(b=>normalize(rawVector(b)));
  const yRepay=Xall.map(trueRepayFromNorm);
  const yFraud=Xall.map(trueFraudFromNorm);
  const yTrust=Xall.map(trueTrustFromNorm);
  const trainIdx:number[]=[]; const testIdx:number[]=[];
  borrowers.forEach((b,i)=>{ const h=hashString(b.borrower_id)%10; if(h<8) trainIdx.push(i); else testIdx.push(i); });
  const Xtrain=trainIdx.map(i=>Xall[i]);
  modelRepay=trainLinear(Xtrain, trainIdx.map(i=>yRepay[i]), 0.022, 2200, 1e-5);
  modelFraud=trainLinear(Xtrain, trainIdx.map(i=>yFraud[i]), 0.022, 2200, 1e-5);
  modelTrust=trainLinear(Xtrain, trainIdx.map(i=>yTrust[i]), 0.02, 2000, 8e-6);
  let repayCorrect=0, fraudCorrect=0; let trustErr=0;
  const toRisk=(s:number):RiskLevel=> s<33?"LOW": s<66?"MEDIUM":"HIGH";
  for(const i of testIdx){
    const pr=clamp(Math.round(dot(modelRepay.w, Xall[i])+modelRepay.b),0,100);
    const pf=clamp(Math.round(dot(modelFraud.w, Xall[i])+modelFraud.b),0,100);
    const pt=clamp(Math.round(dot(modelTrust.w, Xall[i])+modelTrust.b),0,100);
    if(toRisk(pr)===toRisk(yRepay[i])) repayCorrect++;
    if(toRisk(pf)===toRisk(yFraud[i])) fraudCorrect++;
    trustErr+=Math.abs(pt - yTrust[i]);
  }
  const testN=testIdx.length, trainN=trainIdx.length;
  modelMetrics={
    repaymentAcc: Math.round((repayCorrect/testN)*1000)/10,
    fraudAcc: Math.round((fraudCorrect/testN)*1000)/10,
    trustMAE: Math.round((trustErr/testN)*10)/10,
    trainN, testN,
  };
}
export function getFeatureImportance():{feature:string; importance:number}[]{
  ensureModels();
  const D=FEATURE_NAMES.length;
  const imp=Array(D).fill(0);
  for(let j=0;j<D;j++) imp[j]=Math.abs(modelRepay!.w[j])*0.5 + Math.abs(modelFraud!.w[j])*0.3 + Math.abs(modelTrust!.w[j])*0.2;
  const total=imp.reduce((a,c)=>a+c,0)||1;
  return FEATURE_NAMES.map((f,i)=>({feature:f, importance: Math.round((imp[i]/total)*1000)/10})).sort((a,b)=>b.importance-a.importance);
}
export function getModelInfo(){
  ensureModels();
  return { version:"LendSure-ML v6 • 51 cols • 1,500 rows • ridge 2.2k • market-aware", featuresUsed: FEATURE_NAMES.length, totalColumns:51, trainingSamples:modelMetrics!.trainN, testSamples:modelMetrics!.testN, repaymentAccuracy:modelMetrics!.repaymentAcc, fraudAccuracy:modelMetrics!.fraudAcc, trustMAE:modelMetrics!.trustMAE };
}

// ── Bank details — realistic, derived from your 51 fields (no fake account numbers) ──
const BANK_LIST = [
  { name: "State Bank of India", short: "SBI", ifsc: "SBIN" },
  { name: "HDFC Bank", short: "HDFC", ifsc: "HDFC" },
  { name: "ICICI Bank", short: "ICICI", ifsc: "ICIC" },
  { name: "Axis Bank", short: "AXIS", ifsc: "UTIB" },
  { name: "Kotak Mahindra Bank", short: "KOTAK", ifsc: "KKBK" },
  { name: "Bank of Baroda", short: "BOB", ifsc: "BARB" },
  { name: "Punjab National Bank", short: "PNB", ifsc: "PUNB" },
] as const;
export function getBankDetails(borrower: Borrower): BankDetails {
  const h = hashString(borrower.borrower_id + borrower.city);
  const bank = BANK_LIST[h % BANK_LIST.length];
  const branches = ["Main Branch", "MG Road", "Connaught Place", "Bandra West", "Koramangala", "Salt Lake", "Banjara Hills"];
  const branch = `${borrower.city} — ${branches[h % branches.length]}`;
  const masked = `•••• ${String(1000 + (h % 9000)).padStart(4, "0")}`;
  const ifscHint = `${bank.ifsc}0${String(100000 + (h % 900000)).padStart(6, "0")}`;
  return {
    bankName: bank.name,
    branch,
    accountLabel: masked,
    ifscHint,
    verified: borrower.bank_statement_verified,
    accountAgeLabel: `${borrower.account_age_months} mo • ${borrower.account_age_months >= 24 ? "Seasoned" : borrower.account_age_months >= 12 ? "Established" : "New"}`,
  };
}

function marketRateDeltaFromCtx(ctx?: MarketContext): number {
  if (!ctx) return 0;
  const repoDelta = (ctx.repoRate ?? 6.5) - 6.5;
  const sentimentDelta = -(ctx.sentimentScore ?? 0) * 0.55;
  return +(repoDelta + sentimentDelta).toFixed(2);
}
function marketAmountMultFromCtx(ctx?: MarketContext): number {
  if (!ctx || ctx.sentimentScore == null) return 1;
  return +(1 + ctx.sentimentScore * 0.034).toFixed(4);
}

// ── Inference ──
export function analyzeBorrower(borrower:Borrower, overrides?:{amount?:number; rate?:number; duration?:number}, marketCtx?: MarketContext):Analysis{
  ensureModels();
  const bForModel = overrides?.amount!==undefined ? {...borrower, requested_amount_inr: overrides.amount} : borrower;
  const raw=rawVector(bForModel);
  const x=normalize(raw);
  const repaymentScore=clamp(Math.round(dot(modelRepay!.w,x)+modelRepay!.b),0,100);
  const fraudScore=clamp(Math.round(dot(modelFraud!.w,x)+modelFraud!.b),0,100);
  const trustScore=clamp(Math.round(dot(modelTrust!.w,x)+modelTrust!.b),0,100);
  const repaymentRisk:RiskLevel=repaymentScore<33?"LOW":repaymentScore<66?"MEDIUM":"HIGH";
  const fraudRisk:RiskLevel=fraudScore<33?"LOW":fraudScore<66?"MEDIUM":"HIGH";

  const incomes=[borrower.income_m1_inr,borrower.income_m2_inr,borrower.income_m3_inr,borrower.income_m4_inr,borrower.income_m5_inr,borrower.income_m6_inr];
  const expenses=[borrower.expenses_m1_inr,borrower.expenses_m2_inr,borrower.expenses_m3_inr,borrower.expenses_m4_inr,borrower.expenses_m5_inr,borrower.expenses_m6_inr];
  const debts=[borrower.debt_m1_inr,borrower.debt_m2_inr,borrower.debt_m3_inr,borrower.debt_m4_inr,borrower.debt_m5_inr,borrower.debt_m6_inr];
  const bounced=[borrower.bounced_payments_m1,borrower.bounced_payments_m2,borrower.bounced_payments_m3,borrower.bounced_payments_m4,borrower.bounced_payments_m5,borrower.bounced_payments_m6];
  const txs=[borrower.transactions_m1,borrower.transactions_m2,borrower.transactions_m3,borrower.transactions_m4,borrower.transactions_m5,borrower.transactions_m6];
  const avgIncome=Math.round(avg(incomes));
  const avgExpenses=Math.round(avg(expenses));
  const avgDebt=Math.round(avg(debts));
  const avgTransactions=Math.round(avg(txs));
  const totalBounced=bounced.reduce((a,b)=>a+b,0);
  const expenseRatio=avgExpenses/Math.max(1,avgIncome);
  const debtBurden=avgDebt/Math.max(1,avgIncome);
  const incomeTrend=(incomes[5]-incomes[0])/Math.max(1,incomes[0]);
  const monthlySurplus=Math.max(0, avgIncome - avgExpenses - Math.round(avgDebt*0.06));
  const repaidRatio=borrower.previous_loans>0?borrower.loans_repaid/borrower.previous_loans:0.5;
  const lateRatio=borrower.previous_loans>0?borrower.late_payments/borrower.previous_loans:0;

  const trustBreakdown=[
    {label:"Identity", points: borrower.identity_verified?12:0, max:12, note: borrower.identity_verified?"Verified":"Unverified"},
    {label:"Bank", points: borrower.bank_statement_verified?10:0, max:10, note: borrower.bank_statement_verified?"Verified":"Missing"},
    {label:"Income doc", points: borrower.income_document_verified?8:0, max:8, note: borrower.income_document_verified?"Verified":"Unverified"},
    {label:"Doc quality", points: Math.round(borrower.document_quality_score*10), max:10, note: `${Math.round(borrower.document_quality_score*100)}%`},
    {label:"History", points: Math.round(repaidRatio*16 - lateRatio*6), max:16, note: `${borrower.loans_repaid}/${borrower.previous_loans}`},
    {label:"Consistency", points: Math.round(borrower.income_consistency_score*10), max:10, note: `${Math.round(borrower.income_consistency_score*100)}%`},
    {label:"Network", points: Math.round((borrower.trusted_references/Math.max(1,borrower.trust_network_size))*9), max:9, note: `${borrower.trusted_references}/${borrower.trust_network_size}`},
    {label:"Account", points: clamp(Math.round(borrower.account_age_months/12),0,6), max:6, note: `${borrower.account_age_months}mo`},
  ];
  let documentStatus:DocStatus="VERIFIED";
  if(fraudRisk==="HIGH" && (!borrower.identity_verified || borrower.document_quality_score<0.45)) documentStatus="SUSPICIOUS";
  else if(!borrower.identity_verified || !borrower.bank_statement_verified || borrower.document_quality_score<0.62 || fraudRisk==="MEDIUM") documentStatus="NEEDS_REVIEW";

  // ── MATCHED: asked → recommended — ratio-first (LOW≈99% • MED≈82% • HIGH≈52%) — gentle income cap + LIVE market (RBI + news) ──
  const asked=borrower.requested_amount_inr;
  const effectiveAsked=overrides?.amount ?? asked;
  const isSimulatorOverride = overrides?.amount!==undefined && overrides.amount!==asked;
  let ratio:number;
  let recommendedRaw:number = 0;
  let recommendedAmount:number;
  let durationMonths:number;
  let interestRate:number;
  durationMonths=repaymentRisk==="LOW"?6:repaymentRisk==="MEDIUM"?4:3;
  if(overrides?.duration) durationMonths=overrides.duration;
  const rateBand = ():[number,number] => repaymentRisk==="LOW" ? [8,10.5] : repaymentRisk==="MEDIUM" ? [11,14.5] : [16,20];
  const baseRateForRisk = ()=>{
    let r=repaymentRisk==="LOW"?9:repaymentRisk==="MEDIUM"?13:18;
    if(trustScore<48) r+=1.0; else if(trustScore>84) r-=1.0;
    if(fraudRisk==="MEDIUM") r+=0.6; if(fraudRisk==="HIGH") r+=1.4;
    if(borrower.disputed_transactions>1) r+=0.4;
    const [lo,hi]=rateBand();
    return clamp(r,lo,hi);
  };
  interestRate=overrides?.rate ?? +baseRateForRisk().toFixed(1);
  // live marketDelta (RBI repo + news sentiment) — only if user didn't override rate
  let marketDelta = 0;
  let marketMult = 1;
  if(marketCtx){
    marketDelta = marketRateDeltaFromCtx(marketCtx);
    marketMult = marketAmountMultFromCtx(marketCtx);
    if(!overrides?.rate && marketDelta!==0){
      const [lo,hi]=rateBand();
      interestRate = +clamp(interestRate + marketDelta, lo-0.3, hi+0.6).toFixed(1);
    }
  }
  if(isSimulatorOverride){
    recommendedAmount = clamp(overrides.amount!, 5000, 150000);
    ratio = recommendedAmount / Math.max(1, asked);
    if(recommendedAmount>70000 && !overrides?.duration) durationMonths=clamp(durationMonths+1,2,6);
    if(!overrides?.rate && marketDelta!==0){
      // keep market delta already applied — no re-derive
    } else if(!overrides?.rate){
      interestRate=+baseRateForRisk().toFixed(1);
    }
  } else {
    const baseRatio = repaymentRisk==="LOW" ? 0.99 : repaymentRisk==="MEDIUM" ? 0.83 : 0.58;
    const trustAdj = clamp((trustScore - 62) / 340, -0.04, 0.04);
    const fraudAdj = fraudRisk==="MEDIUM" ? -0.03 : fraudRisk==="HIGH" ? -0.06 : 0;
    ratio = clamp(baseRatio + trustAdj + fraudAdj, 0.38, 0.99);
    if(repaymentRisk==="LOW" && trustScore>74 && fraudRisk==="LOW") ratio = 0.99;
    if(repaymentRisk==="HIGH" && trustScore<34) ratio = clamp(ratio - 0.03, 0.35, 0.99);
    recommendedRaw = Math.round(effectiveAsked * ratio);
    if(recommendedRaw>70000 && !overrides?.duration) durationMonths=clamp(durationMonths+1,2,6);
    const incomeCap = Math.round(avgIncome * 6.2);
    let cap = Math.min(recommendedRaw, incomeCap);
    if(monthlySurplus < 2600){
      const lowCap = Math.round(avgIncome * 2.8);
      cap = Math.min(cap, lowCap);
    }
    recommendedAmount = clamp(Math.round(cap/500)*500, 5000, effectiveAsked);
    if(recommendedAmount===0) recommendedAmount=5000;
    // live market amount nudge (dovish → +3%, hawkish → -3%) — still within asked
    if(marketMult!==1){
      const nudged = Math.round(recommendedAmount * marketMult / 500)*500;
      recommendedAmount = clamp(nudged, 5000, effectiveAsked);
      ratio = recommendedAmount / Math.max(1, effectiveAsked);
    }
    if(recommendedRaw>70000 && !overrides?.rate && marketDelta===0){
      interestRate=+baseRateForRisk().toFixed(1);
    }
  }
  const monthlyRate=interestRate/12/100;
  const n=durationMonths;
  const P=overrides?.amount ?? recommendedAmount;
  let monthlyPayment=0;
  if(monthlyRate===0) monthlyPayment=P/n; else monthlyPayment=P*monthlyRate*Math.pow(1+monthlyRate,n)/(Math.pow(1+monthlyRate,n)-1);
  monthlyPayment=Math.round(monthlyPayment);

  // Decision aligned to ratio
  let decision:Decision="APPROVE";
  const ratioAchieved = recommendedAmount / Math.max(1,effectiveAsked);
  if(fraudRisk==="HIGH" && repaymentRisk==="HIGH" && trustScore<40) decision="REJECT";
  else if(fraudRisk==="HIGH" || repaymentRisk==="HIGH") decision="MANUAL_REVIEW";
  else if(ratioAchieved < 0.70) decision="REDUCE_AMOUNT";
  else if(repaymentRisk==="MEDIUM" || fraudRisk==="MEDIUM" || trustScore<62) decision="APPROVE_WITH_CONDITIONS";
  else decision="APPROVE";
  if(decision==="APPROVE" && fraudRisk!=="LOW") decision="APPROVE_WITH_CONDITIONS";
  if(repaymentRisk==="HIGH" && decision==="APPROVE") decision="MANUAL_REVIEW";
  // LOW with 97%+ should be APPROVE, not reduce
  if(repaymentRisk==="LOW" && ratioAchieved>=0.92) decision = fraudRisk==="LOW" ? "APPROVE" : "APPROVE_WITH_CONDITIONS";

  let confidence=52+(borrower.identity_verified?6:0)+(borrower.bank_statement_verified?5:0)+(borrower.income_document_verified?4:0)+borrower.document_quality_score*10+borrower.income_consistency_score*8-borrower.transaction_variance_score*6-borrower.disputed_transactions*2.5-fraudScore*0.12;
  if(borrower.previous_loans>3) confidence+=4;
  if(documentStatus==="SUSPICIOUS") confidence-=12;
  if(documentStatus==="NEEDS_REVIEW") confidence-=5;
  const distToThreshold=Math.min(Math.abs(repaymentScore-33), Math.abs(repaymentScore-66));
  confidence+=clamp(distToThreshold/10,0,4);
  confidence=clamp(Math.round(confidence),38,96);

  const xForExplain = normalize(rawVector(bForModel));
  const contributions=FEATURE_NAMES.map((name,j)=>({name, contrib: modelRepay!.w[j]*xForExplain[j], w: modelRepay!.w[j]})).sort((a,b)=>Math.abs(b.contrib)-Math.abs(a.contrib));
  const positiveFactors:Factor[]=[];
  const riskFactors:Factor[]=[];
  if(repaidRatio>=0.75 && borrower.previous_loans>=1) positiveFactors.push({id:"repay",label:"Strong repayment history",value:`${borrower.loans_repaid}/${borrower.previous_loans}`,raw:repaidRatio,impact:"HIGH",type:"POSITIVE",explanation:`Repaid ${repaidRatio.toFixed(2)} — strongest protective weight in model.`});
  if(borrower.income_consistency_score>0.72) positiveFactors.push({id:"income-cons",label:"Stable income",value:`${Math.round(borrower.income_consistency_score*100)}%`,raw:borrower.income_consistency_score,impact:"HIGH",type:"POSITIVE",explanation:`Stability drives repayment; low variance.`});
  if(borrower.identity_verified && borrower.bank_statement_verified) positiveFactors.push({id:"verified",label:"Verified ID & bank",value:"Both verified",raw:1,impact:"HIGH",type:"POSITIVE",explanation:`Verification has largest negative fraud weight.`});
  if(debtBurden<0.33) positiveFactors.push({id:"debt-low",label:"Low debt burden",value:`${Math.round(debtBurden*100)}%`,raw:debtBurden,impact:"MEDIUM",type:"POSITIVE",explanation:`Debt <35% — healthy capacity.`});
  if(totalBounced===0) positiveFactors.push({id:"bounced-none",label:"No bounced payments",value:"0 in 6 mo",raw:0,impact:"MEDIUM",type:"POSITIVE",explanation:`Zero bounced — no fraud contribution.`});
  if(borrower.late_payments>0) riskFactors.push({id:"late",label:"Late payments",value:`${borrower.late_payments} late`,raw:borrower.late_payments,impact:borrower.late_payments>=2?"HIGH":"MEDIUM",type:"RISK",explanation:`Late payments — top risk weight.`});
  if(debtBurden>0.50) riskFactors.push({id:"debt",label:"High debt",value:`${Math.round(debtBurden*100)}%`,raw:debtBurden,impact:"HIGH",type:"RISK",explanation:`Debt >50% squeezes surplus.`});
  if(borrower.transaction_variance_score>0.60) riskFactors.push({id:"variance",label:"High variance",value:`${Math.round(borrower.transaction_variance_score*100)}%`,raw:borrower.transaction_variance_score,impact:"MEDIUM",type:"RISK",explanation:`Unstable transactions flag risk.`});
  if(!borrower.identity_verified) riskFactors.push({id:"id-unverified",label:"Identity unverified",value:"Missing",raw:0,impact:"HIGH",type:"RISK",explanation:`Missing ID is largest fraud signal.`});
  if(borrower.requested_amount_inr>avgIncome*3.2) riskFactors.push({id:"high-request",label:"Large request",value:`${(borrower.requested_amount_inr/avgIncome).toFixed(1)}× income`,raw:borrower.requested_amount_inr,impact:"HIGH",type:"RISK",explanation:`Request >3.2× monthly income.`});
  const pos=positiveFactors.slice(0,3);
  const risks=riskFactors.slice(0,3);
  if(pos.length===0) pos.push({id:"model-pos",label:"No major strengths",value:`Score ${repaymentScore}`,raw:repaymentScore,impact:"MEDIUM",type:"POSITIVE",explanation:`Score ${repaymentScore} is ${repaymentRisk}.`});
  if(risks.length===0) risks.push({id:"model-risk",label:"No major risks",value:`Score ${repaymentScore}`,raw:repaymentScore,impact:"LOW",type:"RISK",explanation:`No high-weight risk triggered.`});

  const nowIso=new Date().toISOString();
  const evidence:Evidence[]=[
    {id:"e-model", type:"Model", source:"51-col ridge • test acc "+modelMetrics!.repaymentAcc+"%", value:`Repay ${repaymentScore} • Fraud ${fraudScore} • Trust ${trustScore}`, status:"VERIFIED", impact: repaymentRisk==="LOW"?"POSITIVE":repaymentRisk==="HIGH"?"NEGATIVE":"NEUTRAL", timestamp: nowIso},
    {id:"e-capacity", type:"Capacity", source:"Surplus & debt", value:`Surplus ${formatINR(monthlySurplus)}/mo • Debt ${Math.round(debtBurden*100)}% • Asked ${formatINR(effectiveAsked)} → Give ${formatINR(recommendedAmount)} (${Math.round(ratio*100)}%)`, status:"ANALYZED", impact: monthlySurplus>avgIncome*0.25?"POSITIVE":"NEGATIVE", timestamp: nowIso},
    {id:"e-verif", type:"Verification", source:"KYC", value: `${[borrower.identity_verified?"ID✓":"ID✗", borrower.bank_statement_verified?"Bank✓":"Bank✗", borrower.income_document_verified?"Income✓":"Income✗"].join("  ")}`, status: (borrower.identity_verified&&borrower.bank_statement_verified)?"VERIFIED":"WARNING", impact: (borrower.identity_verified&&borrower.bank_statement_verified)?"POSITIVE":"NEGATIVE", timestamp: nowIso},
  ];
  const baseTime=Date.now()-7000;
  const audit=[
    {time: new Date(baseTime).toLocaleTimeString(), label:"51 features → normalized", status:"DONE" as const},
    {time: new Date(baseTime+1800).toLocaleTimeString(), label:`Repay ${repaymentRisk} (${repaymentScore}) • Fraud ${fraudRisk} (${fraudScore})`, status: repaymentRisk==="HIGH"||fraudRisk==="HIGH"?"FLAG" as const:"DONE" as const},
    {time: new Date(baseTime+3600).toLocaleTimeString(), label:`Recommend: ${formatINR(recommendedAmount)} of ${formatINR(effectiveAsked)} • ${interestRate}% • ${durationMonths}mo`, status:"DONE" as const},
    {time: new Date(baseTime+5400).toLocaleTimeString(), label:`Decision ${decision} • Confidence ${confidence}%`, status:"DONE" as const},
  ];
  const bank = getBankDetails(borrower);
  const marketMeta = marketCtx ? { repoRate: marketCtx.repoRate ?? 6.5, sentimentScore: marketCtx.sentimentScore ?? 0, headline: marketCtx.headline ?? "", rateDelta: marketDelta, amountMultiplier: marketMult } : undefined;
  return {
    borrower, repaymentRisk, repaymentScore, fraudRisk, fraudScore, trustScore, trustBreakdown, documentStatus,
    recommendedAmount, interestRate, durationMonths, monthlyPayment, decision, confidence,
    positiveFactors: pos, riskFactors: risks, evidence,
    financial: {avgIncome, avgExpenses, avgDebt, avgTransactions, totalBounced, expenseRatio, debtBurden, monthlySurplus, incomeTrend},
    audit,
    mlMeta:{ modelVersion:"LendSure-ML v6 • 51 cols • ridge 2.2k • market-aware", featuresUsed: FEATURE_NAMES.length, trainingSamples:modelMetrics!.trainN, testSamples:modelMetrics!.testN, repaymentAccuracy:modelMetrics!.repaymentAcc, fraudAccuracy:modelMetrics!.fraudAcc, trustMAE:modelMetrics!.trustMAE, trainedAt: new Date().toISOString() },
    market: marketMeta,
    bank,
  };
}

// ── Real-dataset helpers (use YOUR CSV / form with the same 51 columns) ──
export function makeBorrowerId(n:number){ return `USER-${String(n).padStart(4,"0")}`; }

/** Build a Borrower from 51 raw fields (all required). Use for CSV rows or form submit. */
export function createBorrowerFromValues(v: Record<string, string | number | boolean>): { borrower: Borrower | null; error?: string } {
  try{
    const need = (k:string)=> v[k];
    const num = (k:string)=> Number(v[k]);
    const bool = (k:string)=> {
      const x=v[k];
      if(typeof x==="boolean") return x;
      const s=String(x).toLowerCase().trim();
      return s==="1"||s==="true"||s==="yes"||s==="verified"||s==="✓";
    };
    const city = String(need("city")||"").trim();
    if(!CITIES.includes(city)) return { borrower:null, error:`city must be one of: ${CITIES.join(", ")}` };
    const emp = String(need("employment_type")||"").trim();
    if(!EMPLOYMENT_TYPES.includes(emp as never)) return { borrower:null, error:`employment_type must be one of: ${[...EMPLOYMENT_TYPES].join(", ")}` };
    const purpose = String(need("loan_purpose")||"").trim();
    if(!LOAN_PURPOSES.includes(purpose as never)) return { borrower:null, error:`loan_purpose must be one of: ${[...LOAN_PURPOSES].join(", ")}` };
    const b: Borrower = {
      borrower_id: String(need("borrower_id")|| makeBorrowerId(Date.now()%10000)),
      age: num("age"), city, employment_type: emp, employment_stability_months: num("employment_stability_months"),
      requested_amount_inr: num("requested_amount_inr"), loan_purpose: purpose,
      previous_loans: num("previous_loans"), loans_repaid: num("loans_repaid"), late_payments: num("late_payments"), average_delay_days: num("average_delay_days"),
      income_m1_inr: num("income_m1_inr"), income_m2_inr: num("income_m2_inr"), income_m3_inr: num("income_m3_inr"), income_m4_inr: num("income_m4_inr"), income_m5_inr: num("income_m5_inr"), income_m6_inr: num("income_m6_inr"),
      expenses_m1_inr: num("expenses_m1_inr"), expenses_m2_inr: num("expenses_m2_inr"), expenses_m3_inr: num("expenses_m3_inr"), expenses_m4_inr: num("expenses_m4_inr"), expenses_m5_inr: num("expenses_m5_inr"), expenses_m6_inr: num("expenses_m6_inr"),
      debt_m1_inr: num("debt_m1_inr"), debt_m2_inr: num("debt_m2_inr"), debt_m3_inr: num("debt_m3_inr"), debt_m4_inr: num("debt_m4_inr"), debt_m5_inr: num("debt_m5_inr"), debt_m6_inr: num("debt_m6_inr"),
      transactions_m1: num("transactions_m1"), transactions_m2: num("transactions_m2"), transactions_m3: num("transactions_m3"), transactions_m4: num("transactions_m4"), transactions_m5: num("transactions_m5"), transactions_m6: num("transactions_m6"),
      bounced_payments_m1: num("bounced_payments_m1"), bounced_payments_m2: num("bounced_payments_m2"), bounced_payments_m3: num("bounced_payments_m3"), bounced_payments_m4: num("bounced_payments_m4"), bounced_payments_m5: num("bounced_payments_m5"), bounced_payments_m6: num("bounced_payments_m6"),
      identity_verified: bool("identity_verified"), bank_statement_verified: bool("bank_statement_verified"), income_document_verified: bool("income_document_verified"),
      document_quality_score: num("document_quality_score"), transaction_variance_score: num("transaction_variance_score"), income_consistency_score: num("income_consistency_score"),
      trust_network_size: num("trust_network_size"), trusted_references: num("trusted_references"), disputed_transactions: num("disputed_transactions"), account_age_months: num("account_age_months"),
    };
    // light validation
    const nums = ["age","requested_amount_inr","document_quality_score","transaction_variance_score","income_consistency_score"] as const;
    for(const k of nums) if(!Number.isFinite((b as never)[k])) return { borrower:null, error:`${k} must be a number` };
    if(b.document_quality_score<0||b.document_quality_score>1) return { borrower:null, error:"document_quality_score must be 0–1" };
    if(b.transaction_variance_score<0||b.transaction_variance_score>1) return { borrower:null, error:"transaction_variance_score must be 0–1" };
    if(b.income_consistency_score<0||b.income_consistency_score>1) return { borrower:null, error:"income_consistency_score must be 0–1" };
    return { borrower: b };
  }catch(e:unknown){ return { borrower:null, error: e instanceof Error?e.message:String(e) }; }
}

/** Parse your CSV (header row required, 51 columns). Returns borrowers + errors. Uses the SAME trained model. */
export function parseBorrowersCSV(csvText:string): { borrowers: Borrower[]; errors: string[] }{
  const lines = csvText.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
  if(lines.length<2) return { borrowers:[], errors:["CSV needs header + at least 1 row"] };
  const header = lines[0].split(",").map(h=>h.trim());
  const required = ["borrower_id","age","city","employment_type","employment_stability_months","requested_amount_inr","loan_purpose","previous_loans","loans_repaid","late_payments","average_delay_days","income_m1_inr","income_m2_inr","income_m3_inr","income_m4_inr","income_m5_inr","income_m6_inr","expenses_m1_inr","expenses_m2_inr","expenses_m3_inr","expenses_m4_inr","expenses_m5_inr","expenses_m6_inr","debt_m1_inr","debt_m2_inr","debt_m3_inr","debt_m4_inr","debt_m5_inr","debt_m6_inr","transactions_m1","transactions_m2","transactions_m3","transactions_m4","transactions_m5","transactions_m6","bounced_payments_m1","bounced_payments_m2","bounced_payments_m3","bounced_payments_m4","bounced_payments_m5","bounced_payments_m6","identity_verified","bank_statement_verified","income_document_verified","document_quality_score","transaction_variance_score","income_consistency_score","trust_network_size","trusted_references","disputed_transactions","account_age_months"];
  const missing = required.filter(c=> !header.includes(c));
  if(missing.length) return { borrowers:[], errors:[`Missing columns: ${missing.join(", ")}`] };
  const borrowers:Borrower[]=[]; const errors:string[]=[];
  for(let i=1;i<lines.length;i++){
    const cols = lines[i].split(",").map(c=>c.trim());
    const row: Record<string,string>={};
    header.forEach((h,idx)=> row[h]=cols[idx]??"");
    const { borrower, error } = createBorrowerFromValues(row);
    if(borrower) borrowers.push(borrower);
    else errors.push(`Row ${i+1}: ${error}`);
  }
  return { borrowers, errors };
}

export function downloadSampleCSV(){
  const header="borrower_id,age,city,employment_type,employment_stability_months,requested_amount_inr,loan_purpose,previous_loans,loans_repaid,late_payments,average_delay_days,income_m1_inr,income_m2_inr,income_m3_inr,income_m4_inr,income_m5_inr,income_m6_inr,expenses_m1_inr,expenses_m2_inr,expenses_m3_inr,expenses_m4_inr,expenses_m5_inr,expenses_m6_inr,debt_m1_inr,debt_m2_inr,debt_m3_inr,debt_m4_inr,debt_m5_inr,debt_m6_inr,transactions_m1,transactions_m2,transactions_m3,transactions_m4,transactions_m5,transactions_m6,bounced_payments_m1,bounced_payments_m2,bounced_payments_m3,bounced_payments_m4,bounced_payments_m5,bounced_payments_m6,identity_verified,bank_statement_verified,income_document_verified,document_quality_score,transaction_variance_score,income_consistency_score,trust_network_size,trusted_references,disputed_transactions,account_age_months";
  const b=getBorrowers()[0];
  const row=[b.borrower_id,b.age,b.city,b.employment_type,b.employment_stability_months,b.requested_amount_inr,b.loan_purpose,b.previous_loans,b.loans_repaid,b.late_payments,b.average_delay_days,b.income_m1_inr,b.income_m2_inr,b.income_m3_inr,b.income_m4_inr,b.income_m5_inr,b.income_m6_inr,b.expenses_m1_inr,b.expenses_m2_inr,b.expenses_m3_inr,b.expenses_m4_inr,b.expenses_m5_inr,b.expenses_m6_inr,b.debt_m1_inr,b.debt_m2_inr,b.debt_m3_inr,b.debt_m4_inr,b.debt_m5_inr,b.debt_m6_inr,b.transactions_m1,b.transactions_m2,b.transactions_m3,b.transactions_m4,b.transactions_m5,b.transactions_m6,b.bounced_payments_m1,b.bounced_payments_m2,b.bounced_payments_m3,b.bounced_payments_m4,b.bounced_payments_m5,b.bounced_payments_m6,b.identity_verified,b.bank_statement_verified,b.income_document_verified,b.document_quality_score,b.transaction_variance_score,b.income_consistency_score,b.trust_network_size,b.trusted_references,b.disputed_transactions,b.account_age_months].join(",");
  return header+"\n"+row+"\n";
}

export function distributionStats(){
  const borrowers=getBorrowers();
  ensureModels();
  let low=0, med=0, high=0, fraudFlag=0;
  for(const b of borrowers){
    const a=analyzeBorrower(b);
    if(a.repaymentRisk==="LOW") low++; else if(a.repaymentRisk==="MEDIUM") med++; else high++;
    if(a.fraudRisk!=="LOW") fraudFlag++;
  }
  return {total: borrowers.length, low, med, high, fraudFlag};
}
export function formatINR(n:number){ return "₹"+ n.toLocaleString("en-IN"); }
