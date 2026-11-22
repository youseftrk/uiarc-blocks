"use client";

import { useRef, useState } from "react";
import { TocProgress, type TocProgressItem } from "./toc-progress";
import styles from "./toc-progress.module.css";

interface Section { id: string; title: string; level: 1 | 2 | 3; body: string[]; code?: string }

const SECTIONS: Section[] = [{id:"cold-starts",title:"Why cold starts mattered",level:1,body:["Every checkout on our platform runs a pricing function before the payment sheet appears. On a warm instance it answers in 38 ms. On a cold one it took 1.9 seconds at the 95th percentile, and in March cold instances served one request in nine.","Those slow requests were not spread evenly. They clustered on the first checkout after a deploy and on regions that sleep overnight, which is exactly when a merchant is most likely to be watching."]},{id:"measuring",title:"Measuring the boot",level:1,body:["We could not fix what we could not see, so the first week went into tracing. Each instance now reports four timestamps: process start, runtime ready, first import resolved and first response written.","Sampling every cold request, instead of one in a hundred like the rest of our traces, gave us 40,000 boots in the first three days. That was enough to split the numbers by region, deploy and memory size."]},{id:"tracing",title:"Tracing every phase",level:2,body:["We added the timestamps to the existing request log instead of a new pipeline. That kept the change to 40 lines and let us compare cold and warm requests in the same query."],code:'boot.mark("runtime-ready");\nconst pricing = await import("./pricing");\nboot.mark("first-import");'},{id:"time-went",title:"Where the time went",level:2,body:["Runtime startup was only 180 ms. Almost everything else was spent before our own code ran: resolving and evaluating 1,400 modules, most of them pulled in by two SDKs we used for a single call each.","Memory size barely mattered. Doubling it bought 90 ms, which told us the boot was waiting on the file system rather than the processor."]},{id:"resolution",title:"Module resolution",level:3,body:["Resolution alone cost 610 ms, because every import walked up six directories looking for a package manifest. Bundling the function into one file removed the walk entirely.","Evaluation was the other half. Several SDKs ran setup code at import time, opening connection pools and reading configuration files the pricing path never touched."]},{id:"lazy-loading",title:"Loading lazily",level:1,body:["The bundle fixed resolution, but evaluation was still slow. The answer was to stop evaluating code a request might never need."]},{id:"splitting",title:"Splitting the bundle",level:2,body:["We split the function into a small entry that handles the common path and three chunks for tax, currency conversion and fraud checks. Only one checkout in five needs any of them.","The entry went from 2.3 MB to 190 KB. Chunks load on first use and stay cached for the life of the instance."]},{id:"warming",title:"Warming the cache",level:2,body:["For the regions that sleep overnight we now send one synthetic checkout ten minutes before local business hours. It costs less than a dollar a month and keeps the first real customer off a cold instance.","We tried keeping instances warm around the clock first. It halved cold starts but tripled the bill for the quietest regions, and the synthetic checkout got most of the benefit for almost none of the cost."]},{id:"results",title:"Results",level:1,body:["Cold starts dropped from 1.9 seconds to 740 ms at the 95th percentile, a 61 percent cut, and cold instances now serve one request in forty. Warm latency did not move.","Checkout abandonment on first requests after a deploy fell from 6.1 to 4.4 percent over the following month."]},{id:"next-time",title:"What we would do differently",level:1,body:["Trace first. We spent two weeks tuning the runtime before a single trace showed us that the runtime was never the problem.","And keep an eye on dependencies you use for one call. Two of ours cost more at boot than the rest of the function combined."]}];

const ITEMS: TocProgressItem[] = SECTIONS.map(section => ({ id: `toc-${section.id}`, label: section.title, level: section.level }));

export default function Demo() {
  const articleRef = useRef<HTMLDivElement>(null);
  const [reading, setReading] = useState(ITEMS[0].label);
  return (
    <div className={styles.dDemo} data-canvas="wide">
      <div className={styles.dLayout}>
        <div ref={articleRef} className={styles.dArticle} tabIndex={0} aria-label="Article">
          <article className={styles.dContent}>
            <header className={styles.dHeader}>
              <h2 className={styles.dTitle}>How we cut checkout cold starts by 61 percent</h2>
              <p className={styles.dByline}>Maya Lindqvist, platform team · September 18, 2026</p>
            </header>
            {SECTIONS.map(section => {
              const Heading = section.level === 1 ? "h3" : section.level === 2 ? "h4" : "h5";
              return (
                <section key={section.id} className={styles.dSection} data-level={section.level}>
                  <Heading id={`toc-${section.id}`} className={styles.dHeading}>{section.title}</Heading>
                  {section.body.map(paragraph => <p key={paragraph.slice(0, 24)}>{paragraph}</p>)}
                  {section.code ? <pre className={styles.dCode}><code>{section.code}</code></pre> : null}
                </section>
              );
            })}
          </article>
        </div>
        <aside className={styles.dAside}>
          <TocProgress items={ITEMS} scrollContainer={articleRef} offset={28} readingTime={6} onActiveChange={id => setReading(ITEMS.find(item => item.id === id)?.label ?? "")} />
          <p className={styles.dReading} aria-live="polite">
            Reading <span>{reading}</span>
          </p>
        </aside>
      </div>
    </div>
  );
}
