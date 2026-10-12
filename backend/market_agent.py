import os
import json
import urllib.parse
import random
from tavily import TavilyClient

import datetime

class MarketAnalystAgent:
    def __init__(self, grok_client):
        self.grok = grok_client
        self.tavily = TavilyClient(api_key=os.getenv("TAVILY_API_KEY"))
        self.model_id = "llama-3.3-70b-versatile"
        # File-Based Persistent Cache
        self.CACHE_FILE = "market_cache.json"
        self.CACHE_DURATION = {
            "feeds": 86400,   # 24 Hours
            "ticker": 86400,  # 24 Hours
            "jobs": 86400     # 24 Hours
        }
        self._load_cache()

    def _load_cache(self):
        if os.path.exists(self.CACHE_FILE):
            try:
                with open(self.CACHE_FILE, "r") as f:
                    self.cache = json.load(f)
            except:
                self.cache = {}
        else:
            self.cache = {}

    def _save_cache_to_disk(self):
        try:
            with open(self.CACHE_FILE, "w") as f:
                json.dump(self.cache, f)
        except Exception as e:
            print(f"Failed to save cache: {e}")

    def _clean_json(self, text):
        return text.strip().replace("```json", "").replace("```", "")

    def _get_from_cache(self, key, duration_type="feeds"):
        if key in self.cache:
            entry = self.cache[key]
            # Handle string timestamps from JSON load
            ts = entry["timestamp"]
            if isinstance(ts, str):
                last_update = datetime.datetime.fromisoformat(ts)
            else:
                last_update = ts
            
            elapsed = (datetime.datetime.now() - last_update).total_seconds()
            if elapsed < self.CACHE_DURATION.get(duration_type, 86400):
                print(f"[{key}] Serving from DISK cache (Age: {int(elapsed/3600)}h)")
                return entry["data"]
        return None

    def _save_to_cache(self, key, data):
        self.cache[key] = {
            "data": data,
            "timestamp": datetime.datetime.now().isoformat()
        }
        self._save_cache_to_disk()

    def get_live_feeds(self, role, skills):
        # Fallback if no role provided
        if not role:
             return {
                "hot_jobs": ["DevOps Engineer", "ML Engineer", "Backend Developer", "Frontend React Dev"],
                "hot_projects": ["CI/CD Pipeline", "AI Chatbot", "E-commerce API", "Portfolio Site"]
            }

        cache_key = f"feeds_{role}_{skills}"
        cached = self._get_from_cache(cache_key, "feeds")
        if cached:
            return cached

        try:
            # 1. Search for trends using Tavily
            # REAL SEARCH for 2025/2026 trends
            query = f"trending job titles and specific technical project ideas for {role} {skills} late 2025 2026"
            search_result = self.tavily.search(query=query, search_depth="basic")
            context = search_result.get("results", [])

            # 2. Use Grok to synthesize trends from search data
            prompt = f"""
            Based on the following search results about market trends:
            {context}

            Generate a "Live Feed" for a candidate aiming for "{role}" with skills: {skills}.
            Return a JSON object with two arrays:
            1. "hot_jobs": 4 trending job titles related to {role}.
            2. "hot_projects": 4 SPECIFIC technical project ideas related to {role}.
            Return ONLY valid JSON.
            """
            
            response = self.grok.chat.completions.create(
                model=self.model_id,
                messages=[
                    {"role": "system", "content": "You are a market analyst. Return JSON only."},
                    {"role": "user", "content": prompt}
                ]
            )
            data = json.loads(self._clean_json(response.choices[0].message.content))
            self._save_to_cache(cache_key, data)
            return data
            
        except Exception as e:
            print(f"Error generating feeds: {e}")
            # Robust Fallback
            return {
                 "hot_jobs": [f"{role} @ TechCorp", "Remote Developer Opportunity", "Startup CTO Role", "Freelance Contract"],
                 "hot_projects": ["AI-Powered Dashboard", "E-commerce Microservices", "Real-time Chat App", "Crypto Portfolio Tracker"]
            }

    def get_stock_ticker(self):
        cache_key = "ticker_global"
        cached = self._get_from_cache(cache_key, "ticker")
        if cached:
            return cached

        try:
            # Scrape real data for top AI/Tech companies
            query = "current stock price and percentage change for NVIDIA, Microsoft, Google, Meta, Tesla, OpenAI valuation"
            search_result = self.tavily.search(query=query, search_depth="basic")
            context = search_result.get("results", [])
            
            prompt = f"""
            Based on these search results:
            {context}
            
            Create a list of 5-7 short stock ticker strings for a UI ticker.
            Format exactly like: "Company (TICKER) ▲ +X.X%" or "Company (TICKER) ▼ -X.X%".
            Include major AI players (NVDA, MSFT, GOOGL, META, TSLA).
            If exact number isn't found, estimate based on context or use "▲ +0.0%" but try to be real.
            Return a JSON object: {{ "ticker": [ "item1", "item2" ... ] }}
            """
            
            response = self.grok.chat.completions.create(
                model=self.model_id,
                messages=[
                    {"role": "system", "content": "You are a financial data parser. Return JSON only."},
                    {"role": "user", "content": prompt}
                ]
            )
            data = json.loads(self._clean_json(response.choices[0].message.content))
            self._save_to_cache(cache_key, data)
            return data
        except Exception as e:
            print(f"Ticker Error: {e}")
            # If rate limited, return fallback but maybe don't cache it so we retry later?
            # Or cache it for a short time to prevent spam? caching for 1 min seems wise if error.
            return {
                "ticker": [
                    "NVIDIA (NVDA) ▲ +2.5%", "Microsoft (MSFT) ▲ +1.2%", 
                    "Google (GOOGL) ▲ +0.8%", "Meta (META) ▼ -0.5%", 
                    "OpenAI (Private) ▲ Valuation Up"
                ]
            }

    def find_job_matches(self, role, skills):
        if not role:
            return []

        cache_key = f"jobs_{role}_{skills}"
        cached = self._get_from_cache(cache_key, "jobs")
        if cached:
            return cached

        try:
            # 1. Perform a real search using Tavily
            # Targeted query for specific platforms (LinkedIn, Indeed)
            query = f"latest {role} jobs {skills} (site:linkedin.com/jobs OR site:indeed.com) apply now"
            search_result = self.tavily.search(query=query, search_depth="basic", max_results=15)
            # ... rest is same ...
            context = search_result.get("results", [])

            # 2. Use Grok to structure the search results into our format
            prompt = f"""
            Act as a job search engine. 
            I have performed a search for "{role}" jobs on LinkedIn and Indeed. 
            Here are the raw search results:
            {json.dumps(context)}

            Extract and format 6 REALISTIC job listings from these results.
            CRITICAL: Prioritize finding REAL snippets that look like job postings from LinkedIn or Indeed.
            
            For each job, provide:
            - "title": Job Title
            - "company": Company Name
            - "location": Location
            - "salary": Salary range (estimate if not in text)
            - "type": Full-time / Contract
            - "match_score": 75-98 (integer, based on skill match)
            - "skills": List of 3-4 matching skills from snippet
            - "description": 1 sentence summary
            - "posted": e.g. "2 days ago"
            - "applicants": integer count (estimate)
            - "link": The direct URL found in the search result.
            
            Return ONLY a JSON array of objects.
            """

            response = self.grok.chat.completions.create(
                model=self.model_id,
                messages=[
                    {"role": "system", "content": "You are a job search assistant. Return JSON only."},
                    {"role": "user", "content": prompt}
                ]
            )
            
            jobs = json.loads(self._clean_json(response.choices[0].message.content))
            
            # Enrich with random logos if missing
            for job in jobs:
                if 'logo' not in job:
                    job['logo'] = random.choice(["🚀", "💡", "🐍", "☁️", "🤖", "💻", "🔥", "✨"])
            
            self._save_to_cache(cache_key, jobs)    
            return jobs

        except Exception as e:
            print(f"Error generating jobs (using fallback): {e}")
            # Mock Data for Rate Limit / Error
            jobs = [
                {
                    "title": f"Senior {role}", 
                    "company": "TechGiant Inc", 
                    "location": "Remote", 
                    "salary": "$120k - $160k", 
                    "type": "Full-time",
                    "match_score": 98,
                    "skills": ["React", "Python", "Cloud"],
                    "description": f"We are looking for an experienced {role} to lead our team.",
                    "posted": "Just now",
                    "applicants": 120
                },
                {
                    "title": f"{role} Developer", 
                    "company": "StartupAI", 
                    "location": "San Francisco, CA", 
                    "salary": "$100k - $140k", 
                    "type": "Hybrid",
                    "match_score": 92,
                    "skills": ["TypeScript", "Node.js", "AWS"],
                    "description": "Join our fast-paced AI startup as a core developer.",
                    "posted": "2 hours ago",
                    "applicants": 45
                },
                 {
                    "title": "Junior Engineer", 
                    "company": "WebSolutions", 
                    "location": "New York, NY", 
                    "salary": "$80k - $110k", 
                    "type": "On-site",
                    "match_score": 85,
                    "skills": ["JavaScript", "HTML/CSS"],
                    "description": "Great opportunity for junior devs to learn and grow.",
                    "posted": "1 day ago",
                    "applicants": 200
                }
            ]
            
            # Add fallback links
            for job in jobs:
                 query = urllib.parse.quote(f"{job.get('title', 'Job')} {job.get('company', '')}")
                 job['link'] = f"https://www.google.com/search?q={query}&ibp=htl;jobs" 
                 job['logo'] = random.choice(["🚀", "💡", "🐍", "☁️", "🤖", "💻", "🔥", "✨"])
                 
            return jobs