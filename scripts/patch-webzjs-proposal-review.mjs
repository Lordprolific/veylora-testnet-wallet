import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const source = resolve(process.cwd(), ".engine/WebZjs/crates/webzjs-wallet/src/bindgen/proposal.rs");
let text = readFileSync(source, "utf8");
if (text.includes("pub fn describe(&self)")) {
  console.log("WebZjs proposal review API already patched.");
  process.exit(0);
}

text += `

#[derive(serde::Serialize)]
struct VeyloraProposalDescription {
    total_fee_zatoshis: u64,
    steps: Vec<VeyloraProposalStep>,
}

#[derive(serde::Serialize)]
struct VeyloraProposalStep {
    fee_zatoshis: u64,
    payments: Vec<VeyloraProposalPayment>,
}

#[derive(serde::Serialize)]
struct VeyloraProposalPayment {
    recipient_address: String,
    amount_zatoshis: Option<u64>,
    memo_base64: Option<String>,
}

#[wasm_bindgen]
impl Proposal {
    /// Expose the exact payments and fee calculated by the upstream ZIP-317 proposal.
    /// The extension must present this result to the user before authorizing a transaction.
    pub fn describe(&self) -> Result<JsValue, JsValue> {
        let steps: Vec<VeyloraProposalStep> = self.inner.steps().iter().map(|step| {
            let payments = step.transaction_request().payments().values().map(|payment| {
                VeyloraProposalPayment {
                    recipient_address: payment.recipient_address().to_string(),
                    amount_zatoshis: payment.amount().map(u64::from),
                    memo_base64: payment.memo().map(zip321::memo_to_base64),
                }
            }).collect();
            VeyloraProposalStep {
                fee_zatoshis: u64::from(step.balance().fee_required()),
                payments,
            }
        }).collect();

        let total_fee_zatoshis = steps.iter().map(|step| step.fee_zatoshis).sum();
        let description = VeyloraProposalDescription { total_fee_zatoshis, steps };
        serde_wasm_bindgen::to_value(&description)
            .map_err(|error| JsValue::from_str(&error.to_string()))
    }
}
`;

writeFileSync(source, text);
console.log("Patched WebZjs Proposal.describe() to expose exact recipient, amount, memo, and fee for review.");
