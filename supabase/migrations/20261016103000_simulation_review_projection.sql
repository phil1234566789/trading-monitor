-- JSON-Einzelprojektionen entpacken denselben TOAST-Wert wiederholt; die lokale Kopie bleibt ungepackt.
create function public.simulation_review_metadata(p_snapshot jsonb)
returns jsonb language plpgsql immutable strict security invoker parallel safe set search_path=pg_catalog as $$
declare source jsonb;
begin
 source:=p_snapshot#>'{}';
 return jsonb_build_object(
  'review0',source#>'{knownAt}',
  'review1',source#>'{setupKey}',
  'review2',source#>'{dealingRange}',
  'review3',source#>'{rangeCourse}',
  'review4',source#>'{priceObservation}',
  'review5',source#>'{entry}',
  'review6',source#>'{m1Check}',
  'review7',source#>'{entryEligibility}',
  'review8',source#>'{checklist,model}',
  'review9',source#>'{checklist,entryPattern}',
  'review10',source#>'{checklist,entryModel}',
  'review11',source#>'{checklist,ruleVersion}',
  'review12',source#>'{checklist,status}',
  'review13',source#>'{checklist,evaluatedAt}',
  'review14',source#>'{checklist,setup,primary,id}',
  'review15',source#>'{checklist,setup,primary,tradeSetupId}',
  'review16',source#>'{checklist,setup,primary,direction}',
  'review17',source#>'{checklist,setup,primary,setupType}',
  'review18',source#>'{checklist,setup,primary,recognizedAt}',
  'review19',source#>'{checklist,setup,primary,reactionRecognizedAt}',
  'review20',source#>'{checklist,setup,primary,targetSelection}',
  'review21',source#>'{checklist,setup,primary,validity}',
  'review22',source#>'{checklist,setup,primary,lifecycle}',
  'review23',source#>'{checklist,setup,primary,sweep}',
  'review24',source#>'{checklist,setup,primary,reactionOB}',
  'review25',source#>'{checklist,checks,h1Trend,status}',
  'review26',source#>'{checklist,checks,h1Trend,details}',
  'review27',source#>'{checklist,checks,h1Trend,m1Anchor}',
  'review28',source#>'{checklist,checks,outerM5Trend,status}',
  'review29',source#>'{checklist,checks,outerM5Trend,details}',
  'review30',source#>'{checklist,checks,outerM5Trend,m1Anchor}',
  'review31',source#>'{checklist,checks,m5Trend,status}',
  'review32',source#>'{checklist,checks,m5Trend,details}',
  'review33',source#>'{checklist,checks,m5Trend,m1Anchor}',
  'review34',source#>'{checklist,checks,liquiditySweep}',
  'review35',source#>'{checklist,checks,reaction}',
  'review36',source#>'{checklist,checks,targets}',
  'review37',source#>'{checklist,checks,time}',
  'review38',source#>'{checklist,checks,antiConfluences,status}',
  'review39',source#>'{checklist,checks,antiConfluences,rules}',
  'review40',source#>'{checklist,checks,antiConfluences,ruleVersion}',
  'review41',source#>'{checklist,checks,antiConfluences,divergences}',
  'review42',source#>'{checklist,checks,confluences,status}',
  'review43',source#>'{checklist,checks,confluences,rules}',
  'review44',source#>'{checklist,checks,confluences,ruleVersion}',
  'review45',source#>'{checklist,checks,confluences,divergences}'
 );
end $$;
revoke all on function public.simulation_review_metadata(jsonb) from public;
grant execute on function public.simulation_review_metadata(jsonb) to anon,authenticated,service_role;

create view public.trade_setup_simulation_setups_review_metadata with(security_invoker=true) as
 select id,run_id,instrument,direction,public.simulation_review_metadata(snapshot) as metadata from public.trade_setup_simulation_setups;
revoke all on public.trade_setup_simulation_setups_review_metadata from public,anon,authenticated,service_role;
grant select on public.trade_setup_simulation_setups_review_metadata to anon,authenticated,service_role;

create view public.trade_setup_simulation_entries_review_metadata with(security_invoker=true) as
 select id,run_id,instrument,direction,public.simulation_review_metadata(snapshot) as metadata from public.trade_setup_simulation_entries;
revoke all on public.trade_setup_simulation_entries_review_metadata from public,anon,authenticated,service_role;
grant select on public.trade_setup_simulation_entries_review_metadata to anon,authenticated,service_role;
