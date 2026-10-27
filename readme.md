# FluxLog

### Mapeamento de Logística por Fluxo de Movimentação

**Transformando movimentação em informação para tomada de decisão.**

---

## Sobre o projeto

A **FluxLog** é uma solução de monitoramento da movimentação interna em setores de estoque de supermercados. Sensores ultrassônicos identificam ocorrências de congestionamento nas áreas monitoradas e as transformam em dados mensuráveis, exibidos em um dashboard web.

A proposta é ampliar a visibilidade sobre o fluxo físico do estoque, permitindo identificar **onde, quando, com que frequência e por quanto tempo** ocorrem congestionamentos prolongados.

## O problema

A operação de um supermercado depende de um fluxo contínuo de mercadorias e pessoas, do recebimento ao abastecimento da área de vendas. Estudos do setor apontam problemas como formação de filas no recebimento, excesso de empilhamento, dificuldade de organização e desperdício de tempo (KUHN; KONZEN, 2019; MARCHON et al., 2018).

Quando um congestionamento se prolonga, parte do tempo do funcionário é comprometida pela espera e pela dificuldade de movimentação, enquanto a empresa continua arcando com o custo da mão de obra. Se essas ocorrências se repetem, o tempo excedente vira um custo operacional que passa despercebido.

## A solução

A FluxLog registra cada ocorrência de congestionamento, mede sua duração e consolida as informações em um dashboard. Com isso, o gestor consegue:

- visualizar quais setores concentram mais ocorrências;
- acompanhar a frequência e a duração dos congestionamentos prolongados;
- estimar o tempo operacional potencialmente comprometido;
- estimar o possível impacto financeiro, quando o custo-hora estiver disponível;
- comparar períodos e avaliar o efeito de mudanças feitas na operação.

## Tecnologias

| Área | Tecnologias |
| --- | --- |
| Front-end | HTML5, CSS3, JavaScript e Chart.js  |
| Hardware | Arduino com sensor ultrassônico HC-SR04 |
| Backend | Node.js (API REST) |
| Banco de dados | MySQL em máquina virtual Linux |
| Protótipo e gestão | Figma, GitHub, Trello e metodologia ágil com Sprints |
