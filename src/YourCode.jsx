import React from "react";
import CreatePage from "./CreatePage";

// YourCode deliberately reuses the original CreatePage IDE and publishing flow.
// The language itself lives in the user's project files, not in a separate visual builder.
export default function YourCode({onNavigate}){
 return <CreatePage url="httc://createpage.fair/ide" onNavigate={onNavigate}/>;
}
