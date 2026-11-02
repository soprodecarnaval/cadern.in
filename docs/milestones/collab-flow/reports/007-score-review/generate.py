import csv, html, json, re, unicodedata
from collections import defaultdict, Counter
from pathlib import Path

REPORT_DIR = Path(__file__).resolve().parent
INPUT_DIR = REPORT_DIR / 'inputs'
base = REPORT_DIR / 'cadernin-score-chain-review'
snapshot = json.loads((INPUT_DIR / 'score-snapshot.json').read_text(encoding="utf-8"))
original_titles = {row['id']: row['originalTitle'] for row in snapshot['rows']}
review = json.loads((INPUT_DIR / 'review-decisions.json').read_text(encoding="utf-8"))
excluded_review_ids = set(review['excludedScoreIds'])
rows = [row for row in snapshot['rows'] if row['sourceProject'] not in review['excludedProjects'] and row['id'] not in excluded_review_ids]
def key(s):
    return re.sub('[^a-z0-9]','',unicodedata.normalize('NFD',s).encode('ascii','ignore').decode().lower())
def cell(s):
    return str(s).replace('|','&#124;').replace('\r','').replace('\n','<br>')
def score_link(score_id):
    return 'https://cadern.in/score/'+score_id
festa_styles = review['festaStyles']
festa_tags = {title: style for style, titles in festa_styles.items() for title in titles}
review_projects = set(review['crossProjectReferenceSources'])
alias_data=json.loads((INPUT_DIR / 'title-aliases.json').read_text(encoding="utf-8"))['near']
parent={}
def alias_root(value):
    parent.setdefault(value,value)
    if parent[value]!=value: parent[value]=alias_root(parent[value])
    return parent[value]
for pair in alias_data:
    left=alias_root(key(pair['title']));right=alias_root(key(pair['candidates'][0]['title']))
    parent[right]=left
style_matches=json.loads((INPUT_DIR / 'carnaval-2024-styles.json').read_text(encoding="utf-8"))
style_matches_2023=json.loads((INPUT_DIR / 'carnaval-2023-styles.json').read_text(encoding="utf-8"))
style_matches_crack=json.loads((INPUT_DIR / 'crack-2026-index-styles.json').read_text(encoding="utf-8"))
style_matches_2023_page=json.loads((INPUT_DIR / 'carnaval-2023-index-styles.json').read_text(encoding="utf-8"))
style_by_id={match['scoreId']:match for match in style_matches+style_matches_2023+style_matches_crack+style_matches_2023_page if match['scoreId']}
manual_style_decisions = review['manualStyles']
byid={row['id']:row for row in rows}
# Matching a screenshot title retains its historical spelling but can establish a link to the same title elsewhere.
extra_link_spellings=[]
existing_title_keys={key(row['displayTitle']) for row in rows}
for match in style_matches_crack+style_matches_2023_page:
    if match['scoreId'] and key(match['providedTitle']) in existing_title_keys and key(match['providedTitle'])!=key(match['storedTitle']):
        parent[alias_root(key(match['storedTitle']))]=alias_root(key(match['providedTitle']))
        if not any(key(old['providedTitle'])==key(match['providedTitle']) and key(old['storedTitle'])==key(match['storedTitle']) for old in extra_link_spellings): extra_link_spellings.append(match)
for row in rows:
    row['reviewedTag']=review['projectStyles'].get(row['sourceProject'])
    if row['sourceProject']=='festa-junina-2024': row['reviewedTag']=festa_tags[row['originalTitle']]
    decision=style_by_id.get(row['id'])
    row['providedStyleTitle']=decision['providedTitle'] if decision else None
    row['styleMatchStatus']=decision['matchStatus'] if decision else None
    row['proposedTag']=decision['style'] if decision and decision['matchStatus']=='tentative' else None
    if decision and decision['matchStatus']=='matched':row['reviewedTag']=decision['style']
    if row['id'] in manual_style_decisions:
        row['reviewedTag']=manual_style_decisions[row['id']]
        row['styleMatchStatus']='matched'
        row['providedStyleTitle']=row['originalTitle']
    year_match=re.search(r'(?:^|/|-)(20[0-9]{2})(?:$|-)',row['songbook'] or row['sourceProject'])
    row['year']=int(year_match.group(1)) if year_match else None
    row['linkTitleKey']=alias_root(key(row['displayTitle']))
    row['reviewAnchorId']=None
    row['reviewAnchorSongbook']=None
    row['anchorReviewStatus']='No earlier matching score'
for row in rows:
    earlier=[other for other in rows if other['destinationProject']==row['destinationProject'] and other['linkTitleKey']==row['linkTitleKey'] and other['year'] and row['year'] and other['year']<row['year']]
    target=None
    if earlier:
        previous_year=max(other['year'] for other in earlier)
        candidates=[other for other in earlier if other['year']==previous_year]
        annual=[other for other in candidates if other['songbook']==str(other['destinationProject'])+'/'+str(previous_year)]
        if annual:candidates=annual
        if len(candidates)==1:
            target=candidates[0]
            row['anchorReviewStatus']='Same project: nearest earlier year'
        else:row['anchorReviewStatus']='Ambiguous earlier-year match; review required'
    elif row['sourceProject'] in review_projects:
        candidates=[other for other in rows if other['sourceProject']=='carnaval-bh-2024' and other['linkTitleKey']==row['linkTitleKey']]
        if len(candidates)==1:
            target=candidates[0]
            row['anchorReviewStatus']='Reviewed cross-project reference to carnaval-bh/2024'
    if target:
        row['reviewAnchorId']=target['id']
        row['reviewAnchorSongbook']=target['songbook']
        if key(row['displayTitle'])!=key(target['displayTitle']):row['anchorReviewStatus']+='; approved title variation'
# Build chains only from reviewed directed links; equal titles alone do not create a chain.
components={row['id']:row['id'] for row in rows}
def component_root(score_id):
    if components[score_id]!=score_id:components[score_id]=component_root(components[score_id])
    return components[score_id]
for row in rows:
    if row['reviewAnchorId']:components[component_root(row['id'])]=component_root(row['reviewAnchorId'])
connected=defaultdict(list)
for row in rows:connected[component_root(row['id'])].append(row)
chain_number=0
for members in sorted(connected.values(),key=lambda members:min(r['id'] for r in members)):
    if len(members)>1:chain_number+=1
    chain_id=f'C{chain_number:03}' if len(members)>1 else None
    for row in members:
        trail=[];seen=set();current=row
        while True:
            assert current['id'] not in seen, 'Score-link cycle'
            seen.add(current['id']);trail.append(current['id'])
            if not current['reviewAnchorId']:break
            current=byid[current['reviewAnchorId']]
        row['chainId']=chain_id
        row['chainTrail']=trail
        row['chainRootId']=trail[-1]
        row['linkedFrom']=[other['id'] for other in rows if other['reviewAnchorId']==row['id']]
for row in rows:
    row['chainStyleSuggestion']=None
    row['chainStyleEvidence']=[]
    row['chainStyleConflict']=False
    if row['styleStatus']!='deferred' or row['reviewedTag'] or not row['chainId']:continue
    seeds=[other for other in rows if other['chainId']==row['chainId'] and other['reviewedTag']]
    styles={('forró' if seed['reviewedTag']=='forrós' else seed['reviewedTag']) for seed in seeds}
    row['chainStyleEvidence']=[seed['id'] for seed in seeds]
    if len(styles)==1:row['chainStyleSuggestion']=next(iter(styles))
    elif len(styles)>1:row['chainStyleConflict']=True
for row in rows:
    reasons = []
    if row['styleStatus'] == 'deferred' and not row['reviewedTag'] and not row['chainStyleSuggestion']:
        reasons.append('Historical styles differ; choose a year-specific style' if row['chainStyleConflict'] else 'Style unresolved')
    if row['anchorReviewStatus'].startswith('Ambiguous'):
        reasons.append('Ambiguous predecessor')
    if row['styleMatchStatus'] == 'tentative':
        reasons.append('Tentative title match')
    if not row['versions'] or row['latestRevisionId'] not in {version['id'] for version in row['versions']}:
        reasons.append('Missing latest revision')
    row['reviewReasons'] = reasons
    row['reviewRequired'] = bool(reasons)

unmatched_index_entries = [
    dict(match, source=source, sourceProject=source_project)
    for source, source_project, matches in [
        ('carnaval-bh/2023 supplied list', 'carnaval-bh-2023', style_matches_2023),
        ('carnaval-bh/2023 screenshot', 'carnaval-bh-2023', style_matches_2023_page),
        ('carnaval-bh/crack-2026 screenshot', 'crack-carnaval-bh-2026', style_matches_crack),
        ('carnaval-bh/2024 supplied list', 'carnaval-bh-2024', style_matches),
    ]
    for match in matches if not match['scoreId']
]

# Only reviewed score IDs can be excluded, and every included title must remain verbatim.
assert excluded_review_ids <= {row['id'] for row in snapshot['rows']}
assert len({row['id'] for row in rows}) == len(rows)
assert all(row['originalTitle'] == original_titles[row['id']] for row in rows)
assert all(len(row['chainTrail']) == len(set(row['chainTrail'])) for row in rows)
assert all(score_id in byid for row in rows for score_id in row['chainTrail'])

by_key=defaultdict(list)
for row in rows:
    by_key[key(row['displayTitle']) or 'missing-title:'+row['id']].append(row)
groups=[]
for index,(normalized,members) in enumerate(sorted(by_key.items()),1):
    members.sort(key=lambda r:(r['sourceProject'],r['originalTitle'],r['id']))
    group_id=f'T{index:03}'
    variants=list(dict.fromkeys(r['originalTitle'] for r in members))
    for row in members:
        row['titleGroup']=group_id
        row['matchType']='Normalized-title candidate' if len(members)>1 else 'Singleton'
        row['candidateChain']=group_id if len(members)>1 else ''
        row['revisionStatus']='No revisions' if not row['versions'] else 'Single revision' if len(row['versions'])==1 else 'Multiple revisions: inspect stored links'
    groups.append({'id':group_id,'key':normalized,'members':members,'variants':variants,'matched':len(members)>1})
byid={r['id']:r for r in rows}
bytitle={g['key']:g for g in groups}
alias_data=json.loads((INPUT_DIR / 'title-aliases.json').read_text(encoding="utf-8"))['near']
aliases=[]
for proposed in alias_data:
    candidate=proposed['candidates'][0]
    source_group=bytitle[key(proposed['title'])]
    target_group=bytitle[key(candidate['title'])]
    aliases.append({'fromGroup':source_group['id'],'toGroup':target_group['id'],'fromTitle':proposed['title'],'toTitle':candidate['title'],'styles':candidate['styles'],'affectedScores':proposed['count'],'evidence':candidate['ids'],'status':'Approved score-link equivalence; all original titles retained'})
for match in extra_link_spellings:
    aliases.append({'fromGroup':bytitle[key(match['providedTitle'])]['id'],'toGroup':bytitle[key(match['storedTitle'])]['id'],'fromTitle':match['providedTitle'],'toTitle':match['storedTitle'],'styles':[match['style']],'affectedScores':1,'evidence':[match['scoreId']],'status':'Matched screenshot spelling; titles retained'})
stats={'scores':len(rows),'revisions':sum(len(r['versions']) for r in rows),'groups':len(groups),'matchedGroups':sum(g['matched'] for g in groups),'matchedScores':sum(len(g['members']) for g in groups if g['matched']),'singletons':sum(not g['matched'] for g in groups),'variationGroups':sum(len(g['variants'])>1 for g in groups),'multiRevisionScores':sum(len(r['versions'])>1 for r in rows),'deferred':sum(r['styleStatus']=='deferred' for r in rows),'orphanParents':len(snapshot.get('orphans',[])),'approvedLinks':sum(bool(r['reviewAnchorId']) for r in rows),'sameProjectLinks':sum(bool(r['reviewAnchorId']) and byid[r['reviewAnchorId']]['destinationProject']==r['destinationProject'] for r in rows),'linkedScores':sum(bool(r['chainId']) for r in rows),'chains':chain_number,'directReviewedDeferred':sum(r['styleStatus']=='deferred' and bool(r['reviewedTag']) for r in rows),'chainStyleSuggestions':sum(bool(r['chainStyleSuggestion']) for r in rows),'remainingDeferred':sum(r['styleStatus']=='deferred' and not r['reviewedTag'] and not r['chainStyleSuggestion'] for r in rows),'styleConflicts':sum(r['chainStyleConflict'] for r in rows),'reviewRequired':sum(r['reviewRequired'] for r in rows),'unmatchedIndexEntries':len(unmatched_index_entries),'ambiguousPredecessors':sum(r['anchorReviewStatus'].startswith('Ambiguous') for r in rows)}

fields=['score_id','original_title','display_title','composer','source_project','planned_songbook','candidate_chain','match_type','group_size','title_variants_in_group','revision_count','revision_status','latest_revision_id','revision_ids','previous_revision_ids','style_status','existing_tags','inferred_grouping_style','style_evidence_score_ids','retired','deleted','score_url','reviewed_tag','approved_reference_score_id','approved_reference_songbook','reference_review_status','chain_id','chain_root_score_id','chain_trail','linked_from_score_ids','provided_style_title','style_match_status','tentative_tag','chain_style_suggestion','chain_style_evidence_score_ids','chain_style_conflict','review_required','review_reasons']
with base.with_suffix('.csv').open('w',encoding='utf-8-sig',newline='') as f:
    writer=csv.DictWriter(f,fieldnames=fields);writer.writeheader()
    for group in groups:
        for r in group['members']:
            writer.writerow(dict(zip(fields,[r['id'],r['originalTitle'],r['displayTitle'],r['composer'],r['sourceProject'],r['songbook'] or '',r['candidateChain'],r['matchType'],len(group['members']),json.dumps(group['variants'],ensure_ascii=False),len(r['versions']),r['revisionStatus'],r['latestRevisionId'],json.dumps([v['id'] for v in r['versions']]),json.dumps({v['id']:v['prevRevisionId'] for v in r['versions']}),r['styleStatus'],json.dumps(r['tags'],ensure_ascii=False),r['inferredStyle'] or '',json.dumps(r['inferenceSources']),r['retired'],r['deleted'],score_link(r['id']),r['reviewedTag'] or '',r['reviewAnchorId'] or '',r['reviewAnchorSongbook'] or '',r['anchorReviewStatus'],r['chainId'] or '',r['chainRootId'],json.dumps(r['chainTrail']),json.dumps(r['linkedFrom']),r['providedStyleTitle'] or '',r['styleMatchStatus'] or '',r['proposedTag'] or '',r['chainStyleSuggestion'] or '',json.dumps(r['chainStyleEvidence']),r['chainStyleConflict'],r['reviewRequired'],json.dumps(r['reviewReasons'],ensure_ascii=False)])))

for filename, matches, indexed in [
    ('cadernin-carnaval-2024-style-matches.csv', style_matches, False),
    ('cadernin-carnaval-2023-style-matches.csv', style_matches_2023, False),
    ('cadernin-carnaval-2023-screenshot-matches.csv', style_matches_2023_page, True),
    ('cadernin-crack-2026-style-matches.csv', style_matches_crack, True),
]:
    columns = (['index'] if indexed else []) + ['providedTitle', 'storedTitle', 'style', 'scoreId', 'matchBasis', 'matchStatus']
    with (REPORT_DIR / filename).open('w', encoding='utf-8-sig', newline='') as handle:
        writer = csv.DictWriter(handle, fieldnames=columns)
        writer.writeheader()
        writer.writerows(matches)

md=['# Complete score chain review','',f"Production project `{snapshot['project']}`; metadata read at {snapshot['generatedAt']}. No data was changed.",'','## Reading this report','','- **Existing history** means revision documents under one score ID. All included score containers currently have one revision: no multi-revision chains were found.','- **Title-match candidate** means separate score IDs have the same title after ignoring case, accents, whitespace and punctuation. This identifies possible relationships, not musical identity or a proven revision sequence.','- Original titles, score IDs and files are preserved. Different title spellings remain visible in every group.','- Reviewed predecessor links prefer the nearest available earlier year within the same destination project. Main annual songbooks take precedence over special songbooks when the prior year has multiple matches. No title renames or merges are performed; file contents were not compared.','- Madeira Pirata and the four rejected Garota duplicates listed in inputs/review-decisions.json are excluded from this report. The canonical 2024 and hyphenated 2025/2026 copies are retained. Reviewed title-variation equivalences are approved for linking only; every original spelling remains visible.', '- Previously reviewed cross-project references from garota/2025, na-tora/2025 and queimando/2024 to carnaval-bh/2024 are used when no same-project earlier-year match exists. Original titles are preserved.', '- Reviewed tags: zagateile/acervo → axé; besourinhos/2024 → beatles; carnaval-bh/festa-junina-2024 → 6 baião, 7 xote, 4 arrasta-pé. Original production tags remain visible separately.','','## Inventory','','| Measure | Count |','|---|---:|']
for label,field in [('Score containers','scores'),('Revision documents','revisions'),('Title-match candidate groups','matchedGroups'),('Scores in title-match candidate groups','matchedScores'),('Singleton scores','singletons'),('Groups with distinct original title spellings','variationGroups'),('Scores with multiple revisions','multiRevisionScores'),('Reviewed score-to-score links','approvedLinks'),('Linked score components','chains'),('Scores in linked components','linkedScores'),('Deferred in migration snapshot','deferred'),('Deferred with directly reviewed tags','directReviewedDeferred'),('Deferred with chain-supported style suggestions','chainStyleSuggestions'),('Still requiring style review','remainingDeferred'),('Score rows requiring review','reviewRequired'),('Unmatched supplied index entries','unmatchedIndexEntries'),('Ambiguous predecessors','ambiguousPredecessors'),('Revision-only score IDs missing a container','orphanParents')]:
    md.append(f'| {label} | {stats[field]} |')
md += ['', '## Review required', '', '| Original title | Score ID | Planned songbook | Reason |', '|---|---|---|---|']
for row in rows:
    if row['reviewRequired']:
        md.append(f"| {cell(row['originalTitle'])} | [{row['id']}]({score_link(row['id'])}) | {row['songbook']} | {cell('; '.join(row['reviewReasons']))} |")
md += ['', '## Unmatched supplied index entries', '', 'These entries have no score row in the matching collection. They remain separate from the score-level review filter.', '', '| Source | Supplied title | Style | Reason |', '|---|---|---|---|']
for entry in unmatched_index_entries:
    md.append(f"| {cell(entry['source'])} | {cell(entry['providedTitle'])} | {entry['style']} | {cell(entry['matchBasis'])} |")

md+=['','## Additional reviewed decisions','', '- carnaval-bh/2023: zé pereira → marchinha; parados no bailão → funk; eu só quero um xodó → forró.', '- carnaval-bh/2026: vapor barato → brazuka.', '- Exclude garota-2025-tapaonaraba, garota-2026-tapaonaraba, garota-2025-pequenaeva and garota-2026-pequenaeva. The original 2024 typo was clarified as the 2026 duplicate.','']
md+=['','## Approved reference decisions','', '| Source songbook | Reviewed predecessor link | No unique predecessor |','|---|---:|---:|']
for project,book in [('garota-2025','garota/2025'),('na-tora-2025','na-tora/2025'),('queimando-2024','queimando/2024')]:
    selected=[r for r in rows if r['sourceProject']==project]
    count=sum(bool(r['reviewAnchorId']) for r in selected)
    md.append(f'| {book} | {count} | {len(selected)-count} |')
md+=['','## Carnaval BH 2024 — supplied style list','', 'All 122 supplied titles are matched and classified, including the user-confirmed Liberar Geral / nada mal (terrasamba) correspondence. Stored titles are unchanged.','', '| Supplied title | Stored title | Style | Match status / basis |','|---|---|---|---|']
for match in style_matches:
    md.append(f"| {cell(match['providedTitle'])} | [{cell(match['storedTitle'])}]({score_link(match['scoreId'])}) | {match['style']} | {cell(match['matchStatus']+' — '+match['matchBasis'])} |")
md+=['','## Carnaval BH 2023 — supplied style list','', 'Number prefixes were ignored. 78 of 80 titles match 2023 scores; Araketu é Bom Demais and Cheguei have no clear 2023 match and remain unassigned. Year-specific styles are retained; reviewed styles are not propagated where years disagree.','', '| Supplied title | Stored original title | Style | Match status / basis |','|---|---|---|---|']
for match in style_matches_2023:
    stored=('['+cell(match['storedTitle'])+']('+score_link(match['scoreId'])+')') if match['scoreId'] else 'No clear 2023 match'
    md.append(f"| {cell(match['providedTitle'])} | {stored} | {match['style']} | {cell(match['matchStatus']+' — '+match['matchBasis'])} |")
md+=['','## Carnaval BH 2023 — additional screenshot page','', '80 entries transcribed; 72 match stored 2023 scores. Combined with the earlier text list and the three subsequent manual decisions, all 153 stored 2023 scores have direct classifications, with no same-year conflicts. Eight index titles lack clear 2023 records. Labels are singularized without changing historical titles.','', '| Index | Screenshot title | Stored original title | Style | Match evidence / status |','|---:|---|---|---|---|']
for match in style_matches_2023_page:
    stored=('['+cell(match['storedTitle'])+']('+score_link(match['scoreId'])+')') if match['scoreId'] else 'No clear 2023 match'
    md.append(f"| {match['index']} | {cell(match['providedTitle'])} | {stored} | {match['style']} | {cell(match['matchStatus']+' — '+match['matchBasis'])} |")
md+=['','## Crack 2026 — screenshot index','', '80 screenshot entries were transcribed. Section labels are singularized: axé, beagá, arrasta-pé, odara, funk, pisadinha, fanfarra, brazuka, internacional, tropicália, technohell, manifestação, zoeira. Of the 85 current crack-2026 scores, 31 match screenshot entries; 49 screenshot entries have no clear record in this collection. No mismatched titles are forced.','', '| Index | Screenshot title | Stored original title | Style | Match evidence / status |','|---:|---|---|---|---|']
for match in style_matches_crack:
    stored=('['+cell(match['storedTitle'])+']('+score_link(match['scoreId'])+')') if match['scoreId'] else 'No clear crack-2026 match'
    md.append(f"| {match['index']} | {cell(match['providedTitle'])} | {stored} | {match['style']} | {cell(match['matchStatus']+' — '+match['matchBasis'])} |")
md+=['','## Festa Junina — approved style review','', '| # | Original title | Composer metadata | Original tags | Reviewed tag |','|---:|---|---|---|---|']
for number,r in enumerate(sorted([r for r in rows if r['sourceProject']=='festa-junina-2024'],key=lambda r:key(r['originalTitle'])),1):
    md.append(f"| {number} | [{cell(r['originalTitle'])}]({score_link(r['id'])}) | {cell(r['composer'])} | {cell(json.dumps(r['tags'],ensure_ascii=False))} | {cell(r['reviewedTag'])} |")
md+=['','## Approved title-variation links — original titles retained','','| Deferred title | Existing title | Candidate groups | Existing style evidence | Affected scores |','|---|---|---|---|---:|']
for alias in aliases:
    md.append(f"| {cell(alias['fromTitle'])} | {cell(alias['toTitle'])} | [{alias['fromGroup']}](#{alias['fromGroup'].lower()}) / [{alias['toGroup']}](#{alias['toGroup'].lower()}) | {cell(', '.join(alias['styles']))} | {alias['affectedScores']} |")
md+=['','## All scores by candidate title group','']
for group in groups:
    md += [f"<a id=\"{group['id'].lower()}\"></a>", f"### {group['id']} — {cell(group['variants'][0])}", '',f"{'Title-match candidate' if group['matched'] else 'Singleton'}; {len(group['members'])} scores; {len(group['variants'])} distinct original title spellings.",'','| Original title | Score ID | Source project | Planned songbook | Existing revision history | Approved reference | Grouping style / review |','|---|---|---|---|---|---|---|']
    for r in group['members']:
        style=r['styleStatus']+(f" → {r['inferredStyle']}" if r['inferredStyle'] else '')
        if r['reviewedTag']:style='Reviewed tag → '+r['reviewedTag']
        elif r['chainStyleSuggestion']:style='Chain-supported suggestion → '+r['chainStyleSuggestion']
        elif r['chainStyleConflict']:style='Reviewed years have different styles; choose explicitly'
        elif r['proposedTag']:style='Tentative title match → '+r['proposedTag']
        revisions=', '.join(v['id'] for v in r['versions']) or 'Missing'
        md.append(f"| {cell(r['originalTitle'])} | [{r['id']}]({score_link(r['id'])}) | {r['sourceProject']} | {r['songbook'] or 'Archived; no songbook'} | {cell(revisions)} ({r['revisionStatus']}) | {('['+r['reviewAnchorId']+']('+score_link(r['reviewAnchorId'])+') — '+r['reviewAnchorSongbook']) if r['reviewAnchorId'] else cell(r['anchorReviewStatus'] or '—')} | {cell(style)} |")
    md.append('')
base.with_suffix('.md').write_text('\n'.join(md)+'\n', encoding='utf-8')
payload=json.dumps({'generatedAt':snapshot['generatedAt'],'stats':stats,'groups':groups,'aliases':aliases,'styleMatches':style_matches,'styleMatches2023':style_matches_2023,'styleMatchesCrack':style_matches_crack,'styleMatches2023Page':style_matches_2023_page,'unmatchedIndexEntries':unmatched_index_entries},ensure_ascii=False).replace('<','\\u003c').replace('&','\\u0026')
page='''<!doctype html>
<html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Cadern.in — all-score chain review</title>
<style>
:root{font-family:system-ui,sans-serif;color:#17332c;background:#f4f7f5}body{margin:0}header,main{max-width:1500px;margin:auto;padding:24px}h1{margin:0 0 8px;font-size:30px}p{line-height:1.5;max-width:1000px}.notice{border-left:4px solid #b77919;padding:12px 16px;background:#fff8e8}.stats{display:flex;flex-wrap:wrap;gap:12px;margin:20px 0}.stat{background:#fff;border:1px solid #dce5df;border-radius:10px;padding:14px;min-width:125px}.stat b{display:block;font-size:27px}.toolbar{display:flex;gap:10px;flex-wrap:wrap;position:sticky;top:0;background:#f4f7f5;padding:14px 0;z-index:1}input,select,button{font:inherit;padding:10px;border:1px solid #b8ccc0;border-radius:7px;background:white}input{flex:1;min-width:240px}button{cursor:pointer}button:disabled{opacity:.4;cursor:default}a{color:#086c58}section.card{background:#fff;border:1px solid #d5e1d8;border-radius:12px;margin:18px 0;overflow:hidden}.card h2{font-size:19px;margin:16px}.meta{margin:0 16px 16px;color:#486357}.scroll{overflow:auto}table{border-collapse:collapse;width:100%;font-size:13px}th,td{text-align:left;padding:12px;vertical-align:top;border-top:1px solid #e3ebe5}th{background:#f1f5f2}td.title{min-width:160px;white-space:pre-wrap}td.identity{min-width:190px;overflow-wrap:anywhere}.small{font-size:12px;color:#52665a}.tag{display:inline-block;padding:3px 8px;margin:2px;border-radius:20px;font-size:12px;background:#e7f1eb}.warn{background:#fff0ce;color:#725016}.muted{color:#52665a}.variants{margin:0 16px 16px;white-space:pre-wrap}.pagination{display:flex;gap:12px;align-items:center;margin:18px 0}summary{cursor:pointer;font-weight:650}details{margin:16px 0}#result-count{margin-top:8px}footer{padding:24px 0;color:#52665a}
</style>
<header><h1>All-score chain review</h1><div id="timestamp" class="muted"></div>
<p class="notice"><b>Reviewed score links preserve all historical title variations.</b> Each stored score still has one revision; reviewed links below connect separate score IDs. Original titles and IDs remain verbatim; reviewed references and tags are annotations only. No cloud data is changed. Musical content has not been compared.</p>
<div class="stats" id="stats"></div>
<p>Title groups ignore case, accents, whitespace and punctuation. Reviewed title variants and matched screenshot spellings link scores without renaming them. Madeira Pirata and the four reviewed Garota duplicates are excluded. Historical titles of every included score are preserved. Approved references preserve every title spelling. Filters narrow the view; all included scores are embedded in this offline report.</p>
<p><b>Reviewed tags:</b> zagateile/acervo → axé; besourinhos/2024 → beatles; carnaval-bh/festa-junina-2024 → 6 baião, 7 xote, 4 arrasta-pé. <b>Link rule:</b> nearest earlier year within the same project first; reviewed cross-project references to carnaval-bh/2024 remain as fallback. Each row shows its predecessor, chain root and full trail.</p>
<p><a href="cadernin-score-chain-review.csv" download>Download every score as CSV</a> · <a href="cadernin-score-chain-review.md">Open complete Markdown report</a></p>
<details><summary>Carnaval BH 2023 screenshot — 72 matched; all 153 stored scores now classified</summary><p>80 screenshot entries transcribed with singular section labels. Eight have no clear 2023 match. The remaining three scores were classified manually; neither index source contradicts the other. <a href="cadernin-carnaval-2023-screenshot-matches.csv" download>Review every screenshot entry</a></p><div class="scroll"><table><thead><tr><th>Index</th><th>Screenshot title</th><th>Stored original title</th><th>2023 style</th><th>Evidence / status</th></tr></thead><tbody id="style-matches-2023-page"></tbody></table></div></details>
<details><summary>Crack 2026 screenshot — 31 matched, 49 index entries absent from the current collection</summary><p>Section titles provide styles; plural labels are singularized. The current collection has 85 scores. <a href="cadernin-crack-2026-style-matches.csv" download>Review all 80 screenshot entries and matches</a></p><div class="scroll"><table><thead><tr><th>Index</th><th>Screenshot title</th><th>Stored original title</th><th>Style</th><th>Evidence / status</th></tr></thead><tbody id="style-matches-crack"></tbody></table></div></details>
<details><summary>Carnaval BH 2023 — 78 matches, 2 titles without a clear 2023 score</summary><p>Numbering ignored. Original titles and year-specific styles preserved. <a href="cadernin-carnaval-2023-style-matches.csv" download>Download all 80 supplied titles and results</a></p><div class="scroll"><table><thead><tr><th>Supplied title</th><th>Stored original title</th><th>2023 style</th><th>Match evidence / status</th></tr></thead><tbody id="style-matches-2023"></tbody></table></div></details>
<details><summary>Carnaval BH 2024 — supplied titles and style matches (122 matched, all confirmed)</summary><p><a href="cadernin-carnaval-2024-style-matches.csv" download>Download all 122 matches</a></p><div class="scroll"><table><thead><tr><th>Supplied title</th><th>Stored original title</th><th>Style</th><th>Match evidence / status</th></tr></thead><tbody id="style-matches"></tbody></table></div></details>
<details><summary>Approved title-variation links — keep all original titles</summary><div class="scroll"><table><thead><tr><th>Original deferred title</th><th>Existing title</th><th>Existing style evidence</th><th>Scores</th></tr></thead><tbody id="aliases"></tbody></table></div></details>
</header>
<main><div class="toolbar"><input id="search" type="search" placeholder="Search original titles, composers, score IDs, projects…" aria-label="Search scores"><select id="mode" aria-label="Review filter"><option value="all">All scores</option><option value="review">Review required</option><option value="matched">Title-match candidates</option><option value="variants">Different original title spellings</option><option value="singletons">Singletons</option><option value="remaining">Still requiring style review</option><option value="differentstyles">Year-specific styles differ</option><option value="chainstyles">Chain-supported style suggestions</option><option value="tentative">Tentative supplied-title match</option><option value="deferred">Deferred in migration snapshot (193)</option><option value="inferred">Inferred grouping styles</option><option value="history">Multiple existing revisions</option><option value="references">Scores with reviewed predecessors</option><option value="linked">All scores in reviewed chains</option><option value="sameproject">Same-project previous-year links</option><option value="tagged">Reviewed tags</option><option value="unclassified2023">2023 scores without a reviewed style</option><option value="crack">Crack 2026 collection</option><option value="festa">Festa Junina reviewed tags</option></select><select id="project" aria-label="Source project"><option value="">All source projects</option></select></div><details id="unmatched-index"><summary id="unmatched-index-summary">Unmatched index entries</summary><p>These titles need source-score identification; they are separate from score-level review items. Search also filters this list.</p><div class="scroll"><table><thead><tr><th>Source index</th><th>Supplied title</th><th>Style</th><th>Reason</th></tr></thead><tbody id="unmatched-index-rows"></tbody></table></div></details><div id="result-count" class="muted" aria-live="polite"></div><div class="pagination"><button id="previous">Previous</button><span id="page-label"></span><button id="next">Next</button></div><div id="groups"></div><footer>Read-only production inventory. Any later chain/alias decision must preserve the title variations shown here.</footer></main>
<script id="report-data" type="application/json">__PAYLOAD__</script>
<script>
const data=JSON.parse(document.getElementById('report-data').textContent);
const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const normalize=value=>String(value).normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').toLowerCase();
const scoreUrl=id=>'https://cadern.in/score/'+encodeURIComponent(id);
const allRows=new Map(data.groups.flatMap(g=>g.members.map(r=>[r.id,r])));
const evidence=ids=>ids.map(id=>'<a href="'+scoreUrl(id)+'" target="_blank" rel="noopener">'+esc(id)+'</a>').join('<br>');
const search=document.getElementById('search'),mode=document.getElementById('mode'),project=document.getElementById('project');
let page=0;const pageSize=25;
document.getElementById('timestamp').textContent='Production metadata read at '+data.generatedAt;
document.getElementById('stats').innerHTML=[['Scores',data.stats.scores],['Candidate title groups',data.stats.matchedGroups],['Scores in those groups',data.stats.matchedScores],['Singletons',data.stats.singletons],['Title-variation groups',data.stats.variationGroups],['Reviewed score links',data.stats.approvedLinks],['Linked chains',data.stats.chains],['Review required',data.stats.reviewRequired],['Unmatched index entries',data.stats.unmatchedIndexEntries]].map(([label,n])=>'<div class="stat"><b>'+n+'</b>'+label+'</div>').join('');
document.getElementById('style-matches').innerHTML=data.styleMatches.map(m=>'<tr><td>'+esc(m.providedTitle)+'</td><td><a href="'+scoreUrl(m.scoreId)+'" target="_blank" rel="noopener">'+esc(m.storedTitle)+'</a></td><td>'+esc(m.style)+'</td><td>'+esc(m.matchStatus)+'<div class="small">'+esc(m.matchBasis)+'</div></td></tr>').join('');
document.getElementById('style-matches-2023').innerHTML=data.styleMatches2023.map(m=>'<tr><td>'+esc(m.providedTitle)+'</td><td>'+(m.scoreId?'<a href="'+scoreUrl(m.scoreId)+'" target="_blank" rel="noopener">'+esc(m.storedTitle)+'</a>':'No clear match in carnaval-bh/2023')+'</td><td>'+esc(m.style)+'</td><td>'+esc(m.matchStatus)+'<div class="small">'+esc(m.matchBasis)+'</div></td></tr>').join('');
document.getElementById('style-matches-crack').innerHTML=data.styleMatchesCrack.map(m=>'<tr><td>'+m.index+'</td><td>'+esc(m.providedTitle)+'</td><td>'+(m.scoreId?'<a href="'+scoreUrl(m.scoreId)+'" target="_blank" rel="noopener">'+esc(m.storedTitle)+'</a>':'No clear match in carnaval-bh/crack-2026')+'</td><td>'+esc(m.style)+'</td><td>'+esc(m.matchStatus)+'<div class="small">'+esc(m.matchBasis)+'</div></td></tr>').join('');
document.getElementById('style-matches-2023-page').innerHTML=data.styleMatches2023Page.map(m=>'<tr><td>'+m.index+'</td><td>'+esc(m.providedTitle)+'</td><td>'+(m.scoreId?'<a href="'+scoreUrl(m.scoreId)+'" target="_blank" rel="noopener">'+esc(m.storedTitle)+'</a>':'No clear match in carnaval-bh/2023')+'</td><td>'+esc(m.style)+'</td><td>'+esc(m.matchStatus)+'<div class="small">'+esc(m.matchBasis)+'</div></td></tr>').join('');
for(const p of [...new Set(data.groups.flatMap(g=>g.members.map(r=>r.sourceProject)))].sort()){const option=document.createElement('option');option.value=p;option.textContent=p;project.append(option);}
document.getElementById('aliases').innerHTML=data.aliases.map(a=>'<tr><td>'+esc(a.fromTitle)+'<div class="small">'+a.fromGroup+'</div></td><td>'+esc(a.toTitle)+'<div class="small">'+a.toGroup+'</div></td><td>'+esc(a.styles.join(', '))+'<details><summary>Existing score evidence</summary>'+evidence(a.evidence)+'</details></td><td>'+a.affectedScores+'</td></tr>').join('');
function eligible(group,row){if(project.value&&row.sourceProject!==project.value)return false;const q=normalize(search.value.trim());if(q&&!normalize([row.id,row.originalTitle,row.displayTitle,row.composer,row.sourceProject,row.songbook,row.reviewedTag,row.providedStyleTitle,row.chainStyleSuggestion,row.proposedTag,row.reviewAnchorSongbook,row.chainId,...row.reviewReasons,...row.chainTrail,group.id,...group.variants].join(' ')).includes(q))return false;switch(mode.value){case'review':return row.reviewRequired;case'matched':return group.matched;case'variants':return group.variants.length>1;case'singletons':return !group.matched;case'remaining':return row.styleStatus==='deferred'&&!row.reviewedTag&&!row.chainStyleSuggestion;case'differentstyles':return row.chainStyleConflict;case'chainstyles':return !!row.chainStyleSuggestion;case'tentative':return row.styleMatchStatus==='tentative';case'deferred':return row.styleStatus==='deferred';case'inferred':return row.styleStatus==='inferred';case'history':return row.versions.length>1;case'references':return !!row.reviewAnchorId;case'linked':return !!row.chainId;case'sameproject':return row.anchorReviewStatus.startsWith('Same project:');case'tagged':return !!row.reviewedTag;case'unclassified2023':return row.sourceProject==='carnaval-bh-2023'&&!row.reviewedTag;case'crack':return row.sourceProject==='crack-carnaval-bh-2026';case'festa':return row.sourceProject==='festa-junina-2024';default:return true;}}
function rowHtml(row){const revisions=row.versions.map(v=>'<a href="'+scoreUrl(row.id)+'/'+encodeURIComponent(v.id)+'" target="_blank" rel="noopener">'+esc(v.id)+'</a>').join(', ')||'None';const chain=row.chainId?'<div><b>'+esc(row.chainId)+'</b></div>'+(row.reviewAnchorId?'Previous: '+evidence([row.reviewAnchorId])+'<div class="small">'+esc(row.reviewAnchorSongbook)+' · '+esc(row.anchorReviewStatus)+'</div>':'Chain root')+'<details><summary>Full chain / original titles</summary>'+row.chainTrail.map(id=>esc(allRows.get(id).originalTitle)+'<br>'+evidence([id])).join('<br>↓<br>')+'</details>'+(row.linkedFrom.length?'<details><summary>Linked from '+row.linkedFrom.length+' scores</summary>'+evidence(row.linkedFrom)+'</details>':''):esc(row.anchorReviewStatus);let style=esc(row.reviewedTag?'Reviewed tag → '+row.reviewedTag:row.styleStatus);if(!row.reviewedTag&&row.chainStyleSuggestion)style='Chain-supported suggestion → '+esc(row.chainStyleSuggestion);else if(!row.reviewedTag&&row.chainStyleConflict)style='Reviewed years have different styles; choose explicitly';else if(!row.reviewedTag&&row.proposedTag)style='Tentative title match → '+esc(row.proposedTag);if(row.providedStyleTitle)style+='<div class="small">Supplied as: '+esc(row.providedStyleTitle)+'</div>';if(row.chainStyleEvidence.length)style+='<details><summary>Reviewed chain style evidence</summary>'+evidence(row.chainStyleEvidence)+'</details>';if(row.inferredStyle&&!row.reviewedTag)style+=' → '+esc(row.inferredStyle);if(row.inferenceSources.length)style+='<details><summary>Style evidence</summary>'+evidence(row.inferenceSources)+'</details>';return '<tr><td class="title">'+esc(row.originalTitle)+(row.reviewRequired?'<div class="tag warn">Review required: '+esc(row.reviewReasons.join('; '))+'</div>':'')+(row.displayTitle!==row.originalTitle?'<div class="small">Current display: '+esc(row.displayTitle)+'</div>':'')+'</td><td class="identity"><a href="'+scoreUrl(row.id)+'" target="_blank" rel="noopener">'+esc(row.id)+'</a><div class="small">'+esc(row.composer||'No composer metadata')+'</div></td><td>'+esc(row.sourceProject)+'<div class="small">→ '+esc(row.songbook||'Archived; no songbook')+'</div></td><td>'+esc(row.revisionStatus)+'<br>'+revisions+'<div class="small">Latest pointer: '+esc(row.latestRevisionId)+'</div></td><td>'+chain+'</td><td>'+style+'<div class="small">Original tags: '+esc(JSON.stringify(row.tags))+'</div></td></tr>';}
function render(){const query=normalize(search.value.trim());const unmatched=data.unmatchedIndexEntries.filter(entry=>(!project.value||entry.sourceProject===project.value)&&(!query||normalize([entry.source,entry.providedTitle,entry.style,entry.matchBasis].join(' ')).includes(query)));document.getElementById('unmatched-index-summary').textContent='Unmatched index entries ('+unmatched.length+') — separate from score rows';document.getElementById('unmatched-index-rows').innerHTML=unmatched.map(entry=>'<tr><td>'+esc(entry.source)+'</td><td>'+esc(entry.providedTitle)+'</td><td>'+esc(entry.style)+'</td><td>'+esc(entry.matchBasis)+'</td></tr>').join('')||'<tr><td colspan="4">No unmatched entries for these filters.</td></tr>';document.getElementById('unmatched-index').open=mode.value==='review';const filtered=data.groups.map(g=>({group:g,rows:g.members.filter(r=>eligible(g,r))})).filter(g=>g.rows.length);const pages=Math.max(1,Math.ceil(filtered.length/pageSize));page=Math.max(0,Math.min(page,pages-1));document.getElementById('result-count').textContent=filtered.reduce((sum,g)=>sum+g.rows.length,0)+' matching scores in '+filtered.length+' title groups';document.getElementById('page-label').textContent='Page '+(page+1)+' / '+pages;document.getElementById('previous').disabled=page===0;document.getElementById('next').disabled=page===pages-1;document.getElementById('groups').innerHTML=filtered.slice(page*pageSize,(page+1)*pageSize).map(({group:g,rows})=>'<section class="card" id="'+g.id+'"><h2>'+g.id+' · '+esc(g.variants[0])+' <span class="tag '+(g.matched?'':'warn')+'">'+(g.matched?'Title-match candidate':'Singleton')+'</span></h2><div class="meta">'+g.members.length+' score IDs · '+g.variants.length+' original title spelling(s)'+(rows.length<g.members.length?' · '+rows.length+' shown by current filters':'')+'</div><div class="variants"><b>Preserved titles:</b> '+g.variants.map(esc).join(' / ')+'</div><div class="scroll"><table><thead><tr><th>Original title — unchanged</th><th>Score ID / composer</th><th>Source → planned songbook</th><th>Existing revision history</th><th>Reviewed score chain</th><th>Grouping style / review</th></tr></thead><tbody>'+rows.map(rowHtml).join('')+'</tbody></table></div></section>').join('')||'<p>No matching scores.</p>';}
for(const field of [search,mode,project])field.addEventListener(field===search?'input':'change',()=>{page=0;render();});document.getElementById('previous').addEventListener('click',()=>{page--;render();});document.getElementById('next').addEventListener('click',()=>{page++;render();});render();
</script></html>'''
base.with_suffix('.html').write_text(page.replace('__PAYLOAD__',payload), encoding='utf-8')
print(json.dumps(stats,indent=2))
print('Artifacts:',base.with_suffix('.html'),base.with_suffix('.csv'),base.with_suffix('.md'))
