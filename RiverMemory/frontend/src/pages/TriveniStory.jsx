import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Card, Note } from "../components/ui";
import { useApi } from "../hooks";

const CHAPTERS = [
  { id: "chapter-1", title: "Where the rivers begin", short: "Three rivers, one meeting place" },
  { id: "chapter-2", title: "The Ganga: a river descends", short: "Geography and a sacred story" },
  { id: "chapter-3", title: "The Yamuna: daughter of the sun", short: "From the Himalaya to the plains" },
  { id: "chapter-4", title: "Saraswati: memory and mystery", short: "Tradition, text and uncertainty" },
  { id: "chapter-5", title: "What does Triveni Sangam mean?", short: "The confluence and its meanings" },
  { id: "chapter-6", title: "Prayag through time", short: "A historical timeline" },
  { id: "chapter-7", title: "Why people come to the Sangam", short: "Faith, bathing and practice" },
  { id: "chapter-8", title: "Kumbh, Magh Mela and Kalpvas", short: "A living pilgrimage tradition" },
  { id: "chapter-9", title: "The Sangam through the ages", short: "A changing city, a lasting place" },
  { id: "chapter-10", title: "Rivers and everyday life", short: "Water, livelihoods and ecosystems" },
  { id: "chapter-11", title: "From heritage to environmental science", short: "Why RiverMemory measures" },
];

const SOURCES = [
  {
    id: "britannica-ganges",
    label: "Encyclopaedia Britannica — Ganges River",
    url: "https://www.britannica.com/place/Ganges-River",
    note: "Geography and river course.",
  },
  {
    id: "britannica-yamuna",
    label: "Encyclopaedia Britannica — Yamuna River",
    url: "https://www.britannica.com/place/Yamuna-River",
    note: "Geography, source and course.",
  },
  {
    id: "unesco-kumbh",
    label: "UNESCO Intangible Cultural Heritage — Kumbh Mela",
    url: "https://ich.unesco.org/en/RL/kumbh-mela-01258",
    note: "Inscribed in 2017; living tradition and transmission.",
  },
  {
    id: "prayagraj-sangam",
    label: "Prayagraj District Administration — Triveni Sangam",
    url: "https://prayagraj.nic.in/tourist-place/triveni-sangam/",
    note: "Local description of the confluence and pilgrimage site.",
  },
  {
    id: "prayagraj-history",
    label: "Prayagraj District Administration — History",
    url: "https://prayagraj.nic.in/history/",
    note: "City history and historical names.",
  },
  {
    id: "britannica-prayagraj",
    label: "Encyclopaedia Britannica — Prayagraj",
    url: "https://www.britannica.com/place/Prayagraj",
    note: "Historical and geographic overview.",
  },
  {
    id: "britannica-kumbh",
    label: "Encyclopaedia Britannica — Kumbh Mela",
    url: "https://www.britannica.com/topic/Kumbh-Mela",
    note: "Festival cycle and traditional myth.",
  },
  {
    id: "cpcb-criteria",
    label: "Central Pollution Control Board — Water Quality Criteria",
    url: "https://cpcb.nic.in/water-quality-criteria/",
    note: "Designated-best-use criteria used for indicative screening in RiverMemory.",
  },
  {
    id: "cpcb-ganga",
    label: "Central Pollution Control Board — National Water Quality Monitoring Programme",
    url: "https://cpcb.nic.in/nwmp-data/",
    note: "Official water-quality monitoring information.",
  },
  {
    id: "usgs-water",
    label: "USGS Water Science School — Water Quality",
    url: "https://www.usgs.gov/special-topics/water-science-school/science/water-quality",
    note: "Introductory explanation of measured water-quality properties.",
  },
  {
    id: "britannica-saraswati",
    label: "Encyclopaedia Britannica — Sarasvati River",
    url: "https://www.britannica.com/place/Sarasvati-River-Asia",
    note: "Historical interpretations of the river and its possible identity.",
  },
  {
    id: "bhagavata-ganga",
    label: "Bhagavata Purana 9.9 — Ganga's descent (translation)",
    url: "https://vedabase.io/en/library/sb/9/9/",
    note: "One devotional textual telling of Bhagiratha and Ganga.",
  },
  {
    id: "bhagavata-yamuna",
    label: "Bhagavata Purana 10.16 — Krishna and the Yamuna (translation)",
    url: "https://vedabase.io/en/library/sb/10/16/",
    note: "One devotional textual account associated with Krishna and the Yamuna.",
  },
  {
    id: "prayagraj-magh",
    label: "Prayagraj District Administration — Magh Mela",
    url: "https://prayagraj.nic.in/tourist-place/magh-mela/",
    note: "Local description of the annual Magh Mela.",
  },
];

const TIMELINE = [
  {
    date: "Ancient texts",
    title: "Prayag in sacred literature",
    text: "The name Prayaga and descriptions of sacred bathing at river confluences occur in layers of Indian religious literature. These texts preserve religious and literary traditions; a passage is not, by itself, a dated archaeological record.",
    source: "prayagraj-history",
    kind: "Textual tradition",
  },
  {
    date: "4th century CE",
    title: "Prayaga in the Gupta-era record",
    text: "The Prayaga pillar inscription of Samudragupta, composed in Sanskrit, is an important historical source associated with the region. It is a political inscription, distinct from later pilgrimage legends.",
    source: "britannica-prayagraj",
    kind: "Historical record",
  },
  {
    date: "16th century",
    title: "A Mughal imperial city",
    text: "Emperor Akbar established a major fort and city at the river junction in the late sixteenth century. The city became known as Allahabad; Prayag remained central to Hindu pilgrimage traditions.",
    source: "britannica-prayagraj",
    kind: "Historical record",
  },
  {
    date: "19th–20th centuries",
    title: "A centre of public life",
    text: "Under British rule, Allahabad became an administrative and educational centre. The city also became prominent in India's independence movement; its name was officially changed to Prayagraj in 2018.",
    source: "prayagraj-history",
    kind: "Modern history",
  },
  {
    date: "Living tradition",
    title: "Mela, pilgrimage and the city today",
    text: "The Magh Mela and the larger Kumbh gatherings bring pilgrims, religious communities, workers and visitors to the riverfront. Their scale and arrangements change over time, while the confluence remains a place of worship and public gathering.",
    source: "unesco-kumbh",
    kind: "Living heritage",
  },
];

const GLOSSARY = [
  ["Sangam", "A meeting or confluence; here, the river junction at Prayagraj."],
  ["Triveni", "Literally associated with three streams or braids; at Prayag, this includes the traditional, unseen Saraswati."],
  ["Pilgrimage", "A journey undertaken as an act of religious devotion or spiritual practice."],
  ["Kalpvas", "A period of disciplined devotional living, traditionally observed by pilgrims at the Magh Mela in Prayag."],
  ["Confluence", "The place where two or more rivers or streams meet."],
  ["Doab", "A tract of land between two rivers; from Persian do (two) and ab (water)."],
  ["pH", "A measure describing how acidic or alkaline a water sample is."],
  ["Dissolved oxygen (DO)", "Oxygen present in water; many aquatic organisms depend on it."],
  ["Biochemical oxygen demand (BOD)", "A test estimate of oxygen used by microbes as they break down biodegradable organic matter."],
  ["Conductivity", "A measure of how readily water conducts electricity, influenced by dissolved ions; it is not a direct pollution verdict."],
  ["Coliform", "A group of bacteria used as indicators in water testing; a result needs careful interpretation and is not a complete safety assessment."],
];

const CREDITS = {
  upstream: {
    file: "Upstream river confluence",
    author: "RiverMemory supplied image",
    page: "#",
    license: "Illustrative reference",
    licenseUrl: "",
  },
  sangam: {
    file: "Boat Gulls Triveni Sangam Allahabad Jan24 A7C 08525.jpg",
    author: "Timothy A. Gonsalves",
    page: "https://commons.wikimedia.org/wiki/File:Boat_Gulls_Triveni_Sangam_Allahabad_Jan24_A7C_08525.jpg",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
  },
  pilgrims: {
    file: "Boat Pilgrims Triveni Sangam Allahabad Jan24 A7C 08513.jpg",
    author: "Timothy A. Gonsalves",
    page: "https://commons.wikimedia.org/wiki/File:Boat_Pilgrims_Triveni_Sangam_Allahabad_Jan24_A7C_08513.jpg",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
  },
  kumbh: {
    file: "Kumbh Mela 2013 Sangam, Allahabd.jpg",
    author: "Lokankara",
    page: "https://commons.wikimedia.org/wiki/File:Kumbh_Mela_2013_Sangam,_Allahabd.jpg",
    license: "CC BY-SA 3.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0/",
  },
  himalaya: {
    file: "ISS view of the Garhwal Himalaya and Gangotri Glacier",
    author: "Earth Science and Remote Sensing Unit, NASA Johnson Space Center",
    page: "https://commons.wikimedia.org/wiki/File:ISS010-E-10625_-_View_of_India_-_Garhwal_Himalayas_-_Nanda_Devi_Goup_-_Milam_Glacier_-_Panwali_Doar_-_Maiktoli_-_Dunagiri_-_Hathi_Parbat_-_Gauri_Parbat_-_Gangotri_Glacier_(cropped).jpg",
    license: "Public domain",
    licenseUrl: "https://www.nasa.gov/nasa-brand-center/images-and-media/",
  },
};

function Citation({ ids }) {
  return (
    <span className="story-citations" aria-label="Sources">
      {ids.map((id) => {
        const source = SOURCES.find((item) => item.id === id);
        return source ? (
          <a key={id} href={`#source-${id}`} aria-label={`Source: ${source.label}`}>
            [{SOURCES.indexOf(source) + 1}]
          </a>
        ) : null;
      })}
    </span>
  );
}

function ImageFigure({ src, alt, credit, className = "", priority = false }) {
  const [failed, setFailed] = useState(false);
  return (
    <figure className={`story-figure ${className}`}>
      {failed ? (
        <div className="story-image-fallback" role="img" aria-label={alt}>
          <span aria-hidden="true">≈</span>
          <strong>River, memory and place</strong>
          <span>Image unavailable</span>
        </div>
      ) : (
        <img
          src={src}
          alt={alt}
          loading={priority ? "eager" : "lazy"}
          fetchpriority={priority ? "high" : "auto"}
          decoding="async"
          onError={() => setFailed(true)}
        />
      )}
      <figcaption>
        {credit.page && <a href={credit.page} target="_blank" rel="noreferrer">{credit.file}</a>}
        {" · "}{credit.author} · {credit.licenseUrl ? (
          <a href={credit.licenseUrl} target="_blank" rel="noreferrer">{credit.license}</a>
        ) : credit.license}
      </figcaption>
    </figure>
  );
}

function DidYouKnow({ title = "A thought to carry with you", children }) {
  return (
    <details className="story-aside">
      <summary>{title}</summary>
      <div>{children}</div>
    </details>
  );
}

function ChapterNav({ active, completed, onSelect }) {
  return (
    <nav className="story-toc" aria-label="Story chapters">
      <p className="story-toc-label">Your journey</p>
      <ol>
        {CHAPTERS.map((chapter, index) => (
          <li key={chapter.id}>
            <a
              href={`#${chapter.id}`}
              className={active === index ? "active" : ""}
              aria-current={active === index ? "location" : undefined}
              onClick={(event) => {
                event.preventDefault();
                onSelect(index);
              }}
            >
              <span className="story-toc-number">{completed.has(index) ? "✓" : String(index + 1).padStart(2, "0")}</span>
              <span>{chapter.title}</span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

function StoryChapter({ index, title, eyebrow, children, image, completed, onComplete }) {
  const chapter = CHAPTERS[index];
  return (
    <section className="story-chapter" id={chapter.id} aria-labelledby={`${chapter.id}-heading`}>
      <div className="chapter-heading">
        <span className="chapter-eyebrow">Chapter {String(index + 1).padStart(2, "0")} · {eyebrow}</span>
        <h2 id={`${chapter.id}-heading`}>{title}</h2>
        <p>{chapter.short}</p>
      </div>
      {image}
      <div className="chapter-copy">{children}</div>
      <ChapterControls index={index} completed={completed} onComplete={onComplete} />
    </section>
  );
}

function ChapterControls({ index, onComplete, completed }) {
  const next = CHAPTERS[index + 1];
  const previous = CHAPTERS[index - 1];
  return (
    <div className="chapter-controls">
      {previous ? (
        <a href={`#${previous.id}`} className="story-text-link">← Previous chapter</a>
      ) : <span />}
      <button className={`btn btn-small ${completed ? "btn-ghost" : ""}`} onClick={() => onComplete(index)}>
        {completed ? "Chapter complete ✓" : "Mark chapter complete"}
      </button>
      {next ? (
        <a href={`#${next.id}`} className="story-text-link">Next chapter →</a>
      ) : <span />}
    </div>
  );
}

function Timeline() {
  const [selected, setSelected] = useState(0);
  const item = TIMELINE[selected];
  return (
    <div className="story-timeline">
      <div className="timeline-steps" role="tablist" aria-label="Prayag through time">
        {TIMELINE.map((entry, index) => (
          <button
            type="button"
            role="tab"
            aria-selected={selected === index}
            aria-controls="timeline-detail"
            id={`timeline-tab-${index}`}
            key={entry.date}
            onClick={() => setSelected(index)}
          >
            <span className="timeline-dot" />
            <span>{entry.date}</span>
          </button>
        ))}
      </div>
      <article
        className="timeline-detail"
        id="timeline-detail"
        role="tabpanel"
        aria-labelledby={`timeline-tab-${selected}`}
      >
        <span className="timeline-kind">{item.kind}</span>
        <h3>{item.title}</h3>
        <p>{item.text}</p>
        <Citation ids={[item.source]} />
      </article>
    </div>
  );
}

function StoryMetric({ label, value, hint, loading, error }) {
  return (
    <div className="story-inline-stat" aria-live="polite">
      <span className="story-stat-label">{label}</span>
      {loading ? <span className="story-stat-value"><span className="spinner" aria-hidden="true" /> Loading…</span> : null}
      {!loading && error ? <span className="story-stat-value story-stat-error">Unavailable</span> : null}
      {!loading && !error ? <span className="story-stat-value">{value}</span> : null}
      {hint ? <span className="story-stat-hint">{hint}</span> : null}
    </div>
  );
}

export default function TriveniStory() {
  const [active, setActive] = useState(0);
  const [completed, setCompleted] = useState(() => new Set());
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let frame = 0;
    const updateProgress = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const scrollable = document.documentElement.scrollHeight - window.innerHeight;
        setProgress(scrollable > 0 ? Math.min(100, Math.round((window.scrollY / scrollable) * 100)) : 0);
      });
    };
    updateProgress();
    window.addEventListener("scroll", updateProgress, { passive: true });
    window.addEventListener("resize", updateProgress);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", updateProgress);
      window.removeEventListener("resize", updateProgress);
    };
  }, []);

  useEffect(() => {
    const elements = CHAPTERS.map((chapter) => document.getElementById(chapter.id)).filter(Boolean);
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (!visible.length) return;
        const index = CHAPTERS.findIndex((chapter) => chapter.id === visible[0].target.id);
        if (index >= 0) setActive(index);
      },
      { rootMargin: "-15% 0px -65% 0px" },
    );
    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, []);

  const selectChapter = (index) => {
    setActive(index);
    document.getElementById(CHAPTERS[index].id)?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      block: "start",
    });
  };

  const markComplete = (index) => {
    setCompleted((previous) => new Set(previous).add(index));
    if (index < CHAPTERS.length - 1) selectChapter(index + 1);
  };

  const dashboard = useApi("/api/dashboard");
  const locations = useApi("/api/locations");
  const rainfallSummary = useApi("/api/rainfall/summary");

  const locationCounts = useMemo(() => {
    if (!locations.data) return { total: 0, ganga: 0, yamuna: 0 };
    const total = locations.data.length;
    const ganga = locations.data.filter((site) => String(site.river).toLowerCase() === "ganga").length;
    const yamuna = locations.data.filter((site) => String(site.river).toLowerCase() === "yamuna").length;
    return { total, ganga, yamuna };
  }, [locations.data]);

  const rainfallTotal = rainfallSummary.data?.total_mm;
  const storyMetrics = [
    { label: "Monitoring stations", value: dashboard.loading || locations.loading ? "Loading…" : dashboard.error || locations.error ? "Unavailable" : `${locationCounts.total}` , hint: "Live station count from the API" },
    { label: "Ganga stations", value: dashboard.loading || locations.loading ? "Loading…" : dashboard.error || locations.error ? "Unavailable" : `${locationCounts.ganga}` , hint: "Current dataset coverage" },
    { label: "Yamuna stations", value: dashboard.loading || locations.loading ? "Loading…" : dashboard.error || locations.error ? "Unavailable" : `${locationCounts.yamuna}` , hint: "Current dataset coverage" },
    { label: "Rainfall total", value: rainfallSummary.loading ? "Loading…" : rainfallSummary.error ? "Unavailable" : rainfallTotal !== undefined && rainfallTotal !== null ? `${rainfallTotal} mm` : "No data", hint: "IMD gridded estimate summary" },
  ];

  return (
    <div className="story-page">
      <div className="story-progress" role="progressbar" aria-label="Story reading progress" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
        <span style={{ width: `${progress}%` }} />
      </div>
      <section className="story-hero" aria-labelledby="story-title">
        <div className="story-hero-copy">
          <span className="story-kicker">A RiverMemory field guide · Prayagraj, Uttar Pradesh</span>
          <h1 id="story-title">Triveni Sangam —<br />The Story of Three Rivers</h1>
          <p>
            At Prayagraj, two great rivers meet in open view. A third belongs to a much older landscape of
            sacred memory. Follow their journeys through geography, legend, pilgrimage and the life of a
            changing river city.
          </p>
          <div className="story-hero-actions">
            <Link className="btn btn-teal" to="/dashboard">Explore the Dashboard</Link>
            <Link className="btn btn-ghost" to="/map">View the Map</Link>
          </div>
          <div className="story-hero-tags" aria-label="Journey topics">
            <span>River geography</span><span>Living traditions</span><span>Environmental care</span>
          </div>
        </div>
        <div className="story-hero-art">
          <ImageFigure
            src="/images/upstream-river-confluence.png"
            alt="A river valley and confluence scene showing a hillside settlement and flowing river."
            credit={CREDITS.upstream}
            className="story-hero-image"
            priority
          />
          <div className="story-image-label"><span>Prayagraj</span><span>Where rivers meet</span></div>
          <svg className="story-river-lines" viewBox="0 0 420 150" fill="none" aria-hidden="true">
            <path d="M5 92C74 25 103 154 173 86S265 31 319 82 374 120 415 48" />
            <path d="M5 112C72 47 110 172 181 106S273 51 325 102 379 140 415 70" />
            <path d="M5 132C70 69 117 190 190 126S280 73 331 122 384 159 415 92" />
          </svg>
        </div>
      </section>

      <section className="story-data-strip" aria-label="Story data snapshot">
        <div className="story-inline-data">
          {storyMetrics.map((metric) => (
            <StoryMetric
              key={metric.label}
              label={metric.label}
              value={metric.value}
              hint={metric.hint}
              loading={dashboard.loading || locations.loading || rainfallSummary.loading}
              error={dashboard.error || locations.error || rainfallSummary.error}
            />
          ))}
        </div>
      </section>

      <section className="story-invitation">
        <div>
          <span className="chapter-eyebrow">Before the data</span>
          <h2>A place where water becomes a story</h2>
        </div>
        <p>
          The Sangam is more than a point on a map. Geography tells us how rivers travel; religious traditions
          tell stories of divine arrival; history records cities and gatherings; environmental science asks what
          measurements can show. This journey keeps those ways of knowing distinct—and lets them meet with care.
        </p>
      </section>

      <section className="story-feature-grid" aria-label="Story sections">
        <article className="story-feature-card">
          <span className="chapter-eyebrow">The Sangam</span>
          <h3>Where the Ganga and Yamuna meet</h3>
          <p>At Prayagraj, the rivers are visible together in one place, and their meeting is a central part of the city’s geography and culture.</p>
          <Link to="/map">Open the map →</Link>
        </article>
        <article className="story-feature-card">
          <span className="chapter-eyebrow">Rivers and memory</span>
          <h3>Ganga, Yamuna and Saraswati</h3>
          <p>Saraswati is part of the cultural and legendary context of Prayagraj. It is not a separate measured river in the current data platform.</p>
          <Link to="/comparison">Compare river behaviour →</Link>
        </article>
        <article className="story-feature-card">
          <span className="chapter-eyebrow">Study area</span>
          <h3>Prayagraj, Uttar Pradesh, 2022</h3>
          <p>This field guide is grounded in the same monitoring period and catchment context represented in RiverMemory’s 2022 water-quality and rainfall records.</p>
          <Link to="/dashboard">View the dataset →</Link>
        </article>
        <article className="story-feature-card">
          <span className="chapter-eyebrow">What the data can show</span>
          <h3>Annual ranges, not daily measurements</h3>
          <p>RiverMemory combines monitored stations, annual min-max ranges, and IMD gridded rainfall estimates. It does not display full daily records for every station.</p>
          <Link to="/sources">Review the methods →</Link>
        </article>
      </section>

      <div className="story-reading-layout">
        <ChapterNav active={active} completed={completed} onSelect={selectChapter} />
        <div className="story-reading">
          <StoryChapter index={0} eyebrow="Geography" title="Three rivers, one meeting place" completed={completed.has(0)} onComplete={markComplete}>
            <p>
              The Ganga rises in the Himalayan region of Uttarakhand and flows south and east across the northern
              plains. The Yamuna begins at Yamunotri in the Garhwal Himalaya, then travels south and east through
              the plains. Their courses meet at Prayagraj, where the river junction is called the Sangam.
              <Citation ids={["britannica-ganges", "britannica-yamuna", "prayagraj-sangam"]} />
            </p>
            <div className="river-route" aria-label="A simplified, not-to-scale river journey">
              <div><span className="route-label">Himalaya</span><strong>Ganga</strong><small>south and east</small></div>
              <span className="route-flow" aria-hidden="true">→</span>
              <div className="route-meeting"><span className="route-label">Prayagraj</span><strong>Ganga + Yamuna</strong><small>visible river confluence</small></div>
              <span className="route-flow" aria-hidden="true">←</span>
              <div><span className="route-label">Himalaya</span><strong>Yamuna</strong><small>south and east</small></div>
            </div>
            <p>
              In the sacred geography of Prayag, the meeting is traditionally described as threefold: the
              visible Ganga and Yamuna, together with Saraswati, understood in this tradition as an unseen or
              subterranean river. That third presence is a religious belief, not a scientifically verified
              underground channel at this site.
            </p>
            <DidYouKnow title="Did you know? Why the waters can look different">
              People often point to differences in colour or texture where rivers meet. Appearance changes with
              season, sediment, light and flow; a visual boundary alone does not establish a river's chemical
              condition.
            </DidYouKnow>
          </StoryChapter>

          <StoryChapter
            index={1}
            eyebrow="Geography & tradition"
            title="The Ganga: a river descends"
            completed={completed.has(1)}
            onComplete={markComplete}
            image={(
              <ImageFigure
                src="/images/gangotri-himalaya.jpg"
                alt="A NASA International Space Station photograph of the snow-covered Garhwal Himalaya near the Gangotri region."
                credit={CREDITS.himalaya}
              />
            )}
          >
            <p>
              <strong>The geographical account:</strong> The Ganga system begins in the Himalaya. The Bhagirathi,
              one of its headstreams, issues from the Gangotri-glacier region; it meets the Alaknanda at
              Devprayag, where the united river takes the name Ganga. From there it crosses the northern plains
              and joins the Yamuna at Prayagraj before continuing east toward the Bay of Bengal.
              <Citation ids={["britannica-ganges"]} />
            </p>
            <p>
              <strong>The traditional account:</strong> In a well-known Hindu story, King Bhagiratha undertakes
              severe austerities to bring the heavenly Ganga to Earth. The force of her descent could overwhelm
              the world, so Shiva receives her in his matted hair and releases her in streams. Bhagiratha guides
              the river onward; in some tellings, her waters help liberate his ancestors. The story is a sacred
              narrative about devotion, divine power and release—not a geological explanation of the river's
              source. One textual telling appears in the Bhagavata Purana.
              <Citation ids={["bhagavata-ganga"]} />
            </p>
            <p>
              For many devotees, bathing in the Ganga is associated with purification and spiritual merit.
              These are religious meanings and personal acts of faith; they are not claims about measured water
              quality or medical safety.
            </p>
            <DidYouKnow title="A river and its many names">
              In its upper Himalayan course, the river is called Bhagirathi. At Devprayag, the Bhagirathi and
              Alaknanda meet; downstream the combined river is known as the Ganga. The religious story of
              Bhagiratha gives one traditional explanation for the name Bhagirathi.
            </DidYouKnow>
          </StoryChapter>

          <StoryChapter index={2} eyebrow="Geography & living religion" title="The Yamuna: daughter of the sun" completed={completed.has(2)} onComplete={markComplete}>
            <p>
              The Yamuna begins near Yamunotri in Uttarakhand's Garhwal Himalaya and flows through northern
              India. It passes the region of Delhi and continues toward the Ganga plains, meeting the Ganga at
              Prayagraj. Its long course links mountain landscapes, towns, farms and major cities.
              <Citation ids={["britannica-yamuna"]} />
            </p>
            <p>
              In Hindu traditions, Yamuna is also Yamuna Devi, a goddess. She is often described as the daughter
              of Surya, the sun, and the twin sister of Yama, associated with death and moral order. Devotional
              traditions personify the river as a compassionate protector; the relationship between Yamuna and
              Yama gives some worshippers a particular reason to seek her blessing.
            </p>
            <p>
              The Yamuna also has an important place in Krishna traditions. Krishna's childhood stories are
              closely associated with the river and the Braj region, including Vrindavan. These stories shape
              songs, festivals, pilgrimage routes and artistic life across generations. One devotional account
              appears in the Bhagavata Purana.
              <Citation ids={["bhagavata-yamuna"]} />
            </p>
            <p>
              A river can therefore be both a physical watercourse with a measurable flow and a presence in
              devotional life. The two descriptions answer different questions; neither should be mistaken for
              the other.
            </p>
            <DidYouKnow title="Yamuna or Jamuna?">
              Jamuna is a common regional spelling and pronunciation of Yamuna. The river's name appears in
              many languages, poems and local traditions along its course.
            </DidYouKnow>
          </StoryChapter>

          <StoryChapter index={3} eyebrow="Text, faith & uncertainty" title="Saraswati: memory and mystery" completed={completed.has(3)} onComplete={markComplete}>
            <p>
              Saraswati occupies several overlapping roles in Indian traditions. In Vedic literature, the name
              is associated with a river and with a powerful sacred presence. In later Hindu traditions,
              Saraswati is widely revered as the goddess of learning, speech, music and the arts. The river,
              goddess and cultural memory are related in tradition, but they are not identical kinds of evidence.
              <Citation ids={["britannica-saraswati"]} />
            </p>
            <p>
              At Prayag, the traditional idea of a hidden Saraswati helps make the confluence <em>Triveni</em>:
              three streams joining. Pilgrims may speak of the river as invisible or flowing beneath the ground.
              The belief is meaningful within religious geography, but no verified scientific observation has
              established a physical underground Saraswati joining the Ganga and Yamuna at the Sangam.
            </p>
            <p>
              Researchers have proposed different ways of interpreting references to Saraswati in ancient
              texts, including attempts to connect them with now-changed or seasonal river systems in
              north-western India. The locations, dates and identification of such palaeochannels remain subjects
              of research and debate. They should not be collapsed into proof of a hidden river at Prayagraj.
            </p>
            <Note>
              <strong>Three careful labels:</strong> sacred belief describes what communities hold meaningful;
              historical interpretation studies texts and past landscapes; established geography describes
              channels and flows supported by mapped or measured evidence.
            </Note>
          </StoryChapter>

          <StoryChapter index={4} eyebrow="Meaning & sacred geography" title="What does Triveni Sangam mean?" completed={completed.has(4)} onComplete={markComplete}>
            <p>
              <em>Sangam</em> means a meeting or confluence. <em>Triveni</em> evokes three streams or braids.
              At Prayagraj, the Ganga and Yamuna meet in the river landscape; in Hindu sacred geography, the
              unseen Saraswati completes the three. The Prayagraj district administration describes the place
              as the meeting of these three rivers and a major pilgrimage site.
              <Citation ids={["prayagraj-sangam"]} />
            </p>
            <p>
              The Sangam's importance is layered. Its river junction made it a distinctive landscape; religious
              traditions made it a tirtha—a crossing place between the everyday and the sacred. Over many
              generations, pilgrimage, bathing, storytelling, ritual and public gatherings have connected
              individuals and communities to the site.
            </p>
            <p>
              To understand its significance is not to say that all visitors share one belief or practice.
              People arrive as pilgrims, families, workers, residents, researchers and travellers, each carrying
              different memories and reasons for being there.
            </p>
          </StoryChapter>

          <StoryChapter index={5} eyebrow="A timeline with evidence labels" title="Prayag through time" completed={completed.has(5)} onComplete={markComplete}>
            <p>
              The history of a sacred place cannot be reduced to a single founding date. Literature, inscriptions,
              buildings, travel accounts and living practice offer different kinds of evidence, preserved across
              different periods. Select a point to explore what each can—and cannot—tell us.
            </p>
            <Timeline />
            <DidYouKnow title="Why separate a legend from a historical record?">
              A traditional story can carry deep cultural meaning without being a contemporary eyewitness
              account. An inscription can anchor a political event to a period without explaining every later
              religious practice. Reading both carefully makes the history richer, not less meaningful.
            </DidYouKnow>
          </StoryChapter>

          <StoryChapter
            index={6}
            eyebrow="Faith & practice"
            title="Why people come to the Sangam"
            completed={completed.has(6)}
            onComplete={markComplete}
            image={(
              <ImageFigure
                src="/images/sangam-pilgrims.jpg"
                alt="Pilgrims and boatmen on a boat at the Prayagraj riverfront."
                credit={CREDITS.pilgrims}
              />
            )}
          >
            <p>
              For many Hindus, the Sangam is a place to pray, remember family, seek blessing and take a ritual
              bath. Religious texts and traditions associate bathing at sacred rivers with purification, merit
              or liberation. These are spiritual beliefs; RiverMemory does not present them as scientific
              outcomes.
            </p>
            <p>
              Practices vary. A visit might include a boat journey to the meeting waters, a dip or bath, prayers,
              offerings, remembrance rites or listening to a religious teacher. Priests and boatmen help visitors
              navigate rituals and the riverfront. Not every visitor takes part in every practice, and customs
              differ by family, region and tradition.
            </p>
            <p>
              The shared setting matters too: water, a journey, a gathering and a moment of reflection can make
              the Sangam a powerful place in people's lives. Respectful interpretation leaves room for both
              devotion and diversity.
            </p>
          </StoryChapter>

          <StoryChapter
            index={7}
            eyebrow="Living cultural heritage"
            title="Kumbh, Magh Mela and Kalpvas"
            completed={completed.has(7)}
            onComplete={markComplete}
            image={(
              <ImageFigure
                src="/images/kumbh-sangam-2013.jpg"
                alt="A wide view of pilgrims gathered along the Ganga at the 2013 Kumbh Mela in Prayagraj."
                credit={CREDITS.kumbh}
              />
            )}
          >
            <p>
              Prayag hosts the annual Magh Mela, a seasonal pilgrimage gathering around the Hindu month of
              Magha. A central practice is bathing at the river on auspicious days. Some pilgrims undertake
              <em> Kalpvas</em>: a period of disciplined, devotional living at the Mela, often involving daily
              bathing, prayer, simplicity and study.
              <Citation ids={["prayagraj-magh"]} />
            </p>
            <p>
              The larger Kumbh Mela is held in a cycle at four pilgrimage locations, including Prayagraj. Its
              dates are determined through traditional astrological calculations. UNESCO inscribed Kumbh Mela
              on its Representative List of the Intangible Cultural Heritage of Humanity in 2017, describing
              it as a living tradition transmitted through communities, teachers and pilgrims.
              <Citation ids={["unesco-kumbh", "britannica-kumbh"]} />
            </p>
            <p>
              A well-known religious account connects the Kumbh to <em>Samudra Manthan</em>, the churning of the
              cosmic ocean by devas and asuras in search of amrita, the nectar of immortality. In the story,
              drops of nectar fall at the four Kumbh sites. This is a mythological explanation of sacred
              geography—not a datable historical report of a physical event.
            </p>
            <p>
              Mela arrangements, infrastructure and scale have changed over time. The belief and practice
              continue in a contemporary public gathering that depends on many people, from pilgrims and
              religious organisations to boat workers, city services and local communities.
            </p>
            <DidYouKnow title="One place, different calendars">
              Magh Mela is an annual gathering. Kumbh Mela follows a longer cycle and has its own astrologically
              determined bathing dates. The festivals overlap in their importance to Prayag, but they are not
              simply two names for the same event.
            </DidYouKnow>
          </StoryChapter>

          <StoryChapter index={8} eyebrow="A changing city" title="The Sangam through the ages" completed={completed.has(8)} onComplete={markComplete}>
            <p>
              Prayag's river junction has remained a sacred destination while the city around it has changed.
              Gupta-era inscriptions, Mughal architecture, colonial administration, India's independence
              movement and modern urban life each belong to different histories. They do not all tell the same
              story, and none replaces the long history of pilgrimage.
              <Citation ids={["prayagraj-history", "britannica-prayagraj"]} />
            </p>
            <p>
              Akbar's sixteenth-century fort marks a major imperial intervention at the river meeting. The name
              Allahabad became prominent in the city's later political history; the official name Prayagraj was
              adopted in 2018. Both names appear in historical sources and in public memory.
            </p>
            <p>
              Today the Sangam is at once a religious destination, a river landscape, a place of work and a
              gathering point for millions across changing festival cycles. The living heritage is carried not
              only in monuments and texts but also in journeys, songs, practices, family memory and the work of
              caring for a crowded riverfront.
            </p>
          </StoryChapter>

          <StoryChapter index={9} eyebrow="People & ecosystems" title="Rivers and everyday life" completed={completed.has(9)} onComplete={markComplete}>
            <p>
              Rivers support settlements in many connected ways. They provide water for homes and agriculture,
              sustain fisheries and other livelihoods, carry sediment and nutrients, and form habitats for
              plants, fish, birds and other wildlife. River flows also connect upstream land use to downstream
              places.
            </p>
            <p>
              The same river systems face pressures from untreated or inadequately treated wastewater, solid
              waste, agricultural and urban runoff, reduced or altered flows and habitat change. These pressures
              vary by place and time. A story about a specific pollution event must be supported by observations
              or records—not inferred from a river's appearance, a legend or its sacred status.
            </p>
            <p>
              Culture and ecology meet in the responsibility people feel toward a river. Respect for that
              relationship includes honest evidence, careful stewardship and attention to the communities that
              depend on the water.
            </p>
          </StoryChapter>

          <StoryChapter index={10} eyebrow="The purpose of RiverMemory" title="From heritage to environmental science" completed={completed.has(10)} onComplete={markComplete}>
            <p>
              The river's heritage tells us why it matters to people. To understand environmental condition,
              researchers also need reliable measurements, dated observations, methods and source information.
              A river can be sacred to millions and still require water-quality monitoring; those statements do
              not conflict.
            </p>
            <div className="story-measures">
              <div><strong>pH</strong><span>Acidic or alkaline character of a sample.</span></div>
              <div><strong>DO</strong><span>Dissolved oxygen available in water.</span></div>
              <div><strong>BOD</strong><span>Oxygen demand linked to biodegradable organic matter.</span></div>
              <div><strong>Conductivity</strong><span>Dissolved ions influence how water conducts electricity.</span></div>
              <div><strong>Nitrate</strong><span>A nitrogen compound measured in water; the reporting basis matters.</span></div>
              <div><strong>Coliform</strong><span>Bacterial indicators that need context and are not a full safety test.</span></div>
            </div>
            <p>
              Historical water-quality records can help researchers explore how measured parameters change over
              time and between sampling locations. Rainfall records can help frame seasonal patterns and
              generate questions about possible relationships. They cannot establish cause on their own, and
              comparisons require attention to sampling methods, missing values, river flow and other factors.
            </p>
            <Note tone="warn">
              Cultural or religious significance does not establish water quality or drinking-water safety.
              RiverMemory's screening is indicative only; it is not a drinking-water assessment.
              <Citation ids={["cpcb-criteria", "cpcb-ganga", "usgs-water"]} />
            </Note>
            <p className="story-final-intro">
              <strong>From the Story of the Rivers to Their Real-World Condition</strong>
            </p>
            <p>
              Understanding the heritage of the rivers is the first step. Understanding their environmental
              condition requires actual data, clear sources and careful interpretation. Continue now to explore
              the records RiverMemory holds—and the limits of what they can tell us.
            </p>
            <div className="story-data-links">
              <Link to="/dashboard" className="btn btn-teal">Explore RiverMemory Environmental Data →</Link>
              <div>
                <Link to="/water-quality">Water quality</Link>
                <Link to="/rainfall">Rainfall</Link>
                <Link to="/comparison">Ganga vs Yamuna</Link>
                <Link to="/insights">Environmental insights</Link>
              </div>
            </div>
          </StoryChapter>
        </div>
      </div>

      <section className="story-completion" aria-labelledby="story-completion-heading">
        <span className="chapter-eyebrow">The journey continues</span>
        <h2 id="story-completion-heading">
          {completed.size === CHAPTERS.length ? "You have completed the story." : "Carry the story into the data."}
        </h2>
        <p>
          {completed.size} of {CHAPTERS.length} chapters marked complete. The rivers' stories continue in the
          observations, questions and careful stewardship that follow.
        </p>
        <Link to="/dashboard" className="btn btn-teal">Explore RiverMemory Environmental Data →</Link>
      </section>

      <section className="story-glossary" aria-labelledby="glossary-heading">
        <span className="chapter-eyebrow">A small field glossary</span>
        <h2 id="glossary-heading">Words along the way</h2>
        <div className="glossary-grid">
          {GLOSSARY.map(([term, definition]) => (
            <details key={term}>
              <summary>{term}</summary>
              <p>{definition}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="story-sources" aria-labelledby="sources-heading">
        <h2 id="sources-heading">Sources & further reading</h2>
        <p className="muted small">
          These sources support geographic, historical and cultural context. Religious narratives are identified
          as traditions; current river conditions must be established through measurements.
        </p>
        <ol>
          {SOURCES.map((source, index) => (
            <li id={`source-${source.id}`} key={source.id}>
              <span>[{index + 1}] </span>
              <a href={source.url} target="_blank" rel="noreferrer">{source.label}</a>
              <span className="muted"> — {source.note}</span>
            </li>
          ))}
        </ol>
        <p className="story-image-attribution">
          <strong>Image credits:</strong> Photographs are local copies from Wikimedia Commons for reliable display.
          Sangam images by Timothy A. Gonsalves (CC BY-SA 4.0); Kumbh Mela 2013 image by Lokankara (CC BY-SA 3.0);
          Garhwal Himalaya / Gangotri Glacier image by NASA Johnson Space Center (public domain). Each image caption
          links to its file and license.
        </p>
      </section>
    </div>
  );
}
