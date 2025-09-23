    (function() {
    const originTrials = {
        "eaglerhost.firebaseapp.com": "ApG7NuDNHw4EEd2XRoZmgAuB+c3TpsJ7/8DUWgDTGIJz+RYWv+HufIMLHeR8B8U6dW00RYv7P3EOyVptatjQYgoAAACGeyJvcmlnaW4iOiJodHRwczovL2VhZ2xlcmhvc3QuZmlyZWJhc2VhcHAuY29tOjQ0MyIsImZlYXR1cmUiOiJXZWJBc3NlbWJseUpTUHJvbWlzZUludGVncmF0aW9uIiwiZXhwaXJ5IjoxNzUzMTQyNDAwLCJpc1N1YmRvbWFpbiI6dHJ1ZX0=", 
        "eaglerhost.web.app": "AvNMwLHFuKDmvIpg2BzuBnm0QLOrlUeydPREr+22MnIMpyRCXgtBA/+4dz2Tjb1V+fUAYMgaaCnuKy+aVO4hIwIAAAB+eyJvcmlnaW4iOiJodHRwczovL2VhZ2xlcmhvc3Qud2ViLmFwcDo0NDMiLCJmZWF0dXJlIjoiV2ViQXNzZW1ibHlKU1Byb21pc2VJbnRlZ3JhdGlvbiIsImV4cGlyeSI6MTc1MzE0MjQwMCwiaXNTdWJkb21haW4iOnRydWV9",
		"html.cafe": "AjJ5rkx3KFB3DhBw2u5JYjC+cG/cQIlemFeaO1EJZ1IDVlyrCiPSR1Sbqy7z7ZTZmVWPvwOcl5Nrx971CwcnHg0AAAB1eyJvcmlnaW4iOiJodHRwczovL2h0bWwuY2FmZTo0NDMiLCJmZWF0dXJlIjoiV2ViQXNzZW1ibHlKU1Byb21pc2VJbnRlZ3JhdGlvbiIsImV4cGlyeSI6MTc1MzE0MjQwMCwiaXNTdWJkb21haW4iOnRydWV9",
        "astraa.dev": "ArggD0lfBTEcq2NL926uT94KSyCGzMSZs7E4j6j2LZq63N5FNiVqjM7u/fhXZR5GiyzGvwm5pQ9ggFvOC/NgUQAAAAB2eyJvcmlnaW4iOiJodHRwczovL2FzdHJhYS5kZXY6NDQzIiwiZmVhdHVyZSI6IldlYkFzc2VtYmx5SlNQcm9taXNlSW50ZWdyYXRpb24iLCJleHBpcnkiOjE3NTMxNDI0MDAsImlzU3ViZG9tYWluIjp0cnVlfQ==",		
    };

    const currentOrigin = window.location.href;
    
    for (const domain in originTrials) {
        if (currentOrigin.includes(domain)) {
            const metaTag = document.createElement("meta");
            metaTag.httpEquiv = "origin-trial";
            metaTag.content = originTrials[domain];
            document.head.appendChild(metaTag);
            console.log(`Applied origin trial for ${domain}`);
            break;
        }
    }
})();