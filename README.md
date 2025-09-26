# Malloy
Malloy is an open source language for describing data relationships and transformations. It is both a semantic modeling language and a querying language that runs queries against a relational database. Malloy currently supports BigQuery, Postgres, and DuckDB. 

We've built a Visual Studio Code extension to facilitate building Malloy data models, querying and transforming data, and creating simple visualizations and dashboards.

### [Click here](https://github.dev/malloydata/try-malloy/airports.malloy) to try Malloy in your browser!

---

## Install the Visual Studio Code Extension locally

To write your own Malloy models, use the VS Code Extension, currently available for Mac, Linux, and Windows machines.

1. **Download Visual Studio Code**: Download [Visual Studio Code](https://code.visualstudio.com/)

2. **Add the Malloy (pre-release) extension from the Visual Studio Code Marketplace**: Open VS Code and click the Extensions button on the far left (it looks like 4 blocks with one flying away). This will open the Extension Marketplace. Search for "Malloy" and, once found, click "Install"

3. **Download and unzip the [Sample Models](https://github.com/malloydata/malloy-samples/archive/refs/heads/main.zip)** (models + data).

4. **Open the samples folder in VS Code**. In VS Code, go to File > **Open Folder**... select malloy-samples/duckdb > Open. DuckDB is built into the extension so you're ready to run these.

5. **Start with `1_airports.malloy` in the FAA dataset**. This is a sub-sample of the NTSB Flights dataset. In the editor pane, above `source: airports`, click the word "Preview" to run a `SELECT *`, and click the word "Run" above any query object to run it (see gif below for example).


![show_run](https://user-images.githubusercontent.com/1093458/182458787-ca228186-c954-4a07-b298-f92dbf91e48d.gif)

To get to know the Malloy language, follow the [Quickstart guide](https://malloydata.github.io/documentation/user_guides/basic.html) and/or continue through the numbered models in the FAA directory.

Note: The Malloy VSCode Extension tracks a small amount of anonymous usage data. You can opt out in the extension settings.
 [Learn more](https://policies.google.com/technologies/cookies).

## Join the Community

- Join our [**Malloy Slack Community!**](https://malloydata.github.io/slack) Use this community to ask questions, meet other Malloy users, and share ideas with one another.
- Use [**GitHub issues**](https://github.com/malloydata/malloy-vscode-extension/issues) in this Repo to provide feedback, suggest improvements, report bugs, and start new discussions.

## Resources

Documentation:

- [Malloy Language](https://malloydata.github.io/documentation/user_guides/basic.html) - A quick introduction to the language
- [eCommerce Example Analysis](https://malloydata.github.io/documentation/examples/ecommerce.html) - a walkthrough of the basics on an ecommerce dataset (BigQuery public dataset)
- [Modeling Walkthrough](https://malloydata.github.io/documentation/examples/iowa/iowa.html) - introduction to modeling via the Iowa liquor sales public data set (BigQuery public dataset)

[YouTube](https://www.youtube.com/channel/UCfN2td1dzf-fKmVtaDjacsg) - Watch demos / walkthroughs of Malloy

## Contributing

If you would like to [work on the Malloy VS Code extension](CONTRIBUTING.md), take a look at the instructions for [developing](DEVELOPING.md).

To report security issues please see our [security policy](https://github.com/malloydata/malloy/security/policy).

Malloy is not an officially supported Google product.

## Syntax Example
Here is a simple example of a Malloy query:

```malloy
query: table('malloy-data.faa.flights') -> {
  where: origin ? 'SFO'
  group_by: carrier
  aggregate:
    flight_count is count()
    average_flight_time is flight_time.avg()
}
```

In SQL this would be expressed:
```sql
SELECT
   carrier,
   COUNT(*) as flight_count,
   AVG(flight_time) as average_flight_time
FROM `malloy-data.faa.flights`
WHERE origin = 'SFO'
GROUP BY carrier
ORDER BY flight_count desc         -- malloy automatically orders by the first aggregate
```

Learn more about the syntax and language features of Malloy in the [Quickstart](https://malloydata.github.io/documentation/user_guides/basic.html).
