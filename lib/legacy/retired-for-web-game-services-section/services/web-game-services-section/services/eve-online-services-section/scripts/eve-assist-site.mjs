// Deployable entry point for the eve-assist.561.group Worker. All behavior
// lives in the Assist engine
// (@red-cup-engineering/personal-intelligence-systems-services-section) and
// this package's own EVE Assist application record
// (@red-cup-engineering/eve-online-services-section/application) — per the
// section 4 "engineering builds capability, sites deploy it" convention,
// this file must stay a thin re-export, never grow logic of its own.
import { createAssistWorker } from "@red-cup-engineering/personal-intelligence-systems-services-section/web";
import { eveAssistApplication } from "@red-cup-engineering/eve-online-services-section/application";

export default createAssistWorker(eveAssistApplication);
