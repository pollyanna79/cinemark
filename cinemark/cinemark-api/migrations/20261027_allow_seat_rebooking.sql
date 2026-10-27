ALTER TABLE ingressos
  DROP INDEX uc_sessao_assento,
  ADD UNIQUE KEY uc_sessao_assento_agenda (sessao_id, assento_id, agenda);
